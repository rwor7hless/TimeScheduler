import {
  ConflictException,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LlmService } from '../llm/llm.service';
import { ANGLE_SEEDS, buildWeeklyPrompt } from '../llm/prompts/weekly-report.prompt';
import { PrismaService } from '../prisma/prisma.service';
import { STALE_IN_PROGRESS_MS } from './reports.service';
import { WeeklyDataService } from './weekly-data.service';

/**
 * `/api/reports/:id/stream` — raw SSE endpoint.
 *
 * Intentionally NOT using Nest's `@Sse()` decorator, because that
 * formats every emission as `event:\ndata:...\n\n`. FastAPI emits plain
 * `data: ...\n\n` (see `backend/app/routers/reports.py`), and the
 * frontend's EventSource consumer relies on exactly that shape. We use
 * `@Res() res: Response` and write headers + frames manually.
 */
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportStreamController {
  private readonly logger = new Logger(ReportStreamController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly weeklyData: WeeklyDataService,
  ) {}

  @Get(':id/stream')
  async stream(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.prisma.weeklyReport.findFirst({
      where: { id, user_id: user.id },
    });
    if (!report) {
      throw new NotFoundException('Отчёт не найден');
    }

    // Atomic FSM transition: allow pending/error/done, or stale in_progress.
    const staleBoundary = new Date(Date.now() - STALE_IN_PROGRESS_MS);
    const claim = await this.prisma.weeklyReport.updateMany({
      where: {
        id,
        user_id: user.id,
        OR: [
          { status: { in: ['pending', 'error', 'done'] } },
          { status: 'in_progress', updated_at: { lt: staleBoundary } },
        ],
      },
      data: { status: 'in_progress', error_msg: null, updated_at: new Date() },
    });
    if (claim.count !== 1) {
      throw new ConflictException('Отчёт уже генерируется в другой вкладке.');
    }

    // Open the SSE channel.
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(': open\n\n');

    let disconnected = false;
    res.on('close', () => {
      disconnected = true;
      if (!res.writableEnded) {
        // Client aborted mid-stream — mark the report as errored so the UI
        // can retry. Fire-and-forget; any DB error is logged but not rethrown.
        void this.prisma.weeklyReport
          .update({
            where: { id },
            data: {
              status: 'error',
              error_msg: 'Клиент отключился во время генерации',
              updated_at: new Date(),
            },
          })
          .catch((err) => this.logger.error(`Failed to mark disconnected: ${String(err)}`));
      }
    });

    const accumulated: string[] = [];
    // Модель сначала пишет <scratch>...</scratch> (CoT), потом отчёт. Пока
    // мы не увидели закрывающий тег, копим чанки в scratchBuffer и не шлём
    // ничего клиенту. После </scratch> — возобновляем стрим с остатка.
    let scratchOpen = false;
    let scratchClosed = false;
    let scratchBuffer = '';
    try {
      const data = await this.weeklyData.buildWeeklyData(user.id, report.week_start);
      const messages = buildWeeklyPrompt(data, {
        angleSeedIndex: Math.floor(Math.random() * ANGLE_SEEDS.length),
      });

      for await (const chunk of this.llm.streamChatCompletion(messages, { maxTokens: 4096 })) {
        if (disconnected) break;
        accumulated.push(chunk);

        if (scratchClosed) {
          res.write(`data: ${JSON.stringify({ t: chunk })}\n\n`);
          continue;
        }

        scratchBuffer += chunk;

        if (!scratchOpen) {
          // Ждём первые непустые символы. Если модель начала не со scratch,
          // просто сливаем всё накопленное и продолжаем без буферизации.
          const trimmed = scratchBuffer.trimStart();
          if (trimmed.length === 0) continue;
          if (trimmed.startsWith('<scratch>')) {
            scratchOpen = true;
          } else {
            // Нет CoT — сливаем буфер в стрим разом.
            scratchClosed = true;
            res.write(`data: ${JSON.stringify({ t: scratchBuffer })}\n\n`);
            scratchBuffer = '';
            continue;
          }
        }

        // В режиме scratchOpen ждём закрывающий тег.
        const closeIdx = scratchBuffer.indexOf('</scratch>');
        if (closeIdx !== -1) {
          scratchClosed = true;
          // Всё до и включая </scratch> (+ сразу идущие переводы строк) — режем.
          const afterTag = scratchBuffer
            .slice(closeIdx + '</scratch>'.length)
            .replace(/^[\r\n]+/, '');
          scratchBuffer = '';
          if (afterTag.length > 0) {
            res.write(`data: ${JSON.stringify({ t: afterTag })}\n\n`);
          }
        }
      }

      if (disconnected) {
        return;
      }

      const full = accumulated
        .join('')
        .replace(/<scratch>[\s\S]*?<\/scratch>\s*/i, '')
        .replace(/^\n+/, '');
      if (!full) {
        throw new Error('LLM вернул пустой ответ.');
      }

      await this.prisma.weeklyReport.update({
        where: { id },
        data: {
          status: 'done',
          content: full,
          error_msg: null,
          updated_at: new Date(),
        },
      });
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      const msg =
        (err instanceof Error ? err.message : String(err)).slice(0, 500) || 'Неизвестная ошибка';
      try {
        await this.prisma.weeklyReport.update({
          where: { id },
          data: { status: 'error', error_msg: msg, updated_at: new Date() },
        });
      } catch (dbErr) {
        this.logger.error(`Failed to persist stream error: ${String(dbErr)}`);
      }
      if (!disconnected && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
        res.end();
      }
    }
  }
}
