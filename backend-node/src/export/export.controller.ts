import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { KanbanStatus, Priority, User } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';
import {
  KANBAN_STATUS_VALUES,
  KANBAN_TO_PRISMA,
  KanbanStatusWire,
  PRIORITY_FROM_PRISMA,
  PRIORITY_VALUES,
  PRIORITY_TO_PRISMA,
  PriorityWire,
  KANBAN_FROM_PRISMA,
} from '../tasks/dto/task-create.dto';

/**
 * `/api/export/tasks` + `/api/export/stats` — ports
 * `backend/app/routers/export.py`. Returns JSON or CSV blobs with
 * `Content-Disposition: attachment`.
 *
 * The task export supports the same filter surface as the list endpoint:
 * `priority`, `status`, `board_id`, `tag`, `include_archived`. Rows are
 * serialized as a flat shape (tags joined by `, `) matching Python so
 * existing exports are diff-clean.
 */
@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: StatsService,
  ) {}

  @Get('tasks')
  async exportTasks(
    @CurrentUser() user: User,
    @Res() res: Response,
    @Query('format') formatRaw?: string,
    @Query('priority') priorityRaw?: string,
    @Query('status') statusRaw?: string,
    @Query('board_id') boardIdRaw?: string,
    @Query('tag') tag?: string,
    @Query('include_archived') includeArchivedRaw?: string,
  ): Promise<void> {
    const format = formatRaw === 'csv' ? 'csv' : 'json';
    const includeArchived =
      includeArchivedRaw === 'true' || includeArchivedRaw === '1' || includeArchivedRaw === 'yes';
    const where: Record<string, unknown> = {
      user_id: user.id,
      deleted_at: null,
    };
    if (!includeArchived) where.is_archived = false;

    if (priorityRaw && (PRIORITY_VALUES as readonly string[]).includes(priorityRaw)) {
      where.priority = PRIORITY_TO_PRISMA[priorityRaw as PriorityWire] as Priority;
    }
    if (statusRaw && (KANBAN_STATUS_VALUES as readonly string[]).includes(statusRaw)) {
      where.status = KANBAN_TO_PRISMA[statusRaw as KanbanStatusWire] as KanbanStatus;
    }
    if (boardIdRaw !== undefined) {
      const n = Number.parseInt(boardIdRaw, 10);
      if (Number.isFinite(n)) where.board_id = n;
    }
    if (tag) {
      where.task_tags = { some: { tags: { name: tag, user_id: user.id } } };
    }

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: { created_at: 'asc' },
      include: { task_tags: { include: { tags: true } } },
    });

    const rows = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? '',
      priority: PRIORITY_FROM_PRISMA[t.priority],
      status: KANBAN_FROM_PRISMA[t.status],
      board_id: t.board_id,
      scheduled_start: t.scheduled_start ? t.scheduled_start.toISOString() : '',
      scheduled_end: t.scheduled_end ? t.scheduled_end.toISOString() : '',
      deadline: t.deadline ? t.deadline.toISOString() : '',
      repeat_days: t.repeat_days ?? [],
      completed_at: t.completed_at ? t.completed_at.toISOString() : '',
      created_at: t.created_at.toISOString(),
      is_archived: t.is_archived,
      tags: t.task_tags.map((tt) => tt.tags.name).join(', '),
    }));

    if (format === 'json') {
      const body = JSON.stringify(rows, null, 2);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=tasks.json');
      res.send(body);
      return;
    }

    // CSV
    const headers = [
      'id',
      'title',
      'description',
      'priority',
      'status',
      'board_id',
      'scheduled_start',
      'scheduled_end',
      'deadline',
      'repeat_days',
      'completed_at',
      'created_at',
      'is_archived',
      'tags',
    ];
    const lines: string[] = [];
    if (rows.length > 0) {
      lines.push(headers.join(','));
      for (const r of rows) {
        const vals = headers.map((h) => {
          const v = (r as Record<string, unknown>)[h];
          if (Array.isArray(v)) return csvEscape(v.join(','));
          if (v === null || v === undefined) return '';
          return csvEscape(String(v));
        });
        lines.push(vals.join(','));
      }
    }
    const body = lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tasks.csv');
    res.send(body);
  }

  @Get('stats')
  async exportStats(
    @CurrentUser() user: User,
    @Res() res: Response,
    @Query('format') formatRaw?: string,
    @Query('period') periodRaw?: string,
  ): Promise<void> {
    const format = formatRaw === 'csv' ? 'csv' : 'json';
    const period = periodRaw && ['week', 'month', 'year'].includes(periodRaw) ? periodRaw : 'month';
    const periodDays = { week: 7, month: 30, year: 365 }[period] ?? 30;
    const stats = await this.stats.getStats(user.id, { periodDays, weekStart: null });

    if (format === 'json') {
      const body = JSON.stringify(stats, null, 2);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=stats.json');
      res.send(body);
      return;
    }

    // CSV: flatten to 6 scalar fields — matches Python.
    const headers = [
      'active_tasks',
      'completed_last_month',
      'overdue_count',
      'avg_completion_hours',
      'productivity_percent',
      'most_active_hours',
    ];
    const row = [
      stats.active_tasks,
      stats.completed_last_month,
      stats.overdue_count,
      stats.avg_completion_hours ?? '',
      stats.productivity_percent ?? '',
      stats.most_active_hours.join(', '),
    ];
    const body = headers.join(',') + '\r\n' + row.map((v) => csvEscape(String(v))).join(',');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=stats.csv');
    res.send(body);
  }
}

/**
 * Minimal RFC-4180 escape — wraps the value in double quotes and escapes
 * embedded quotes whenever the value contains `,`, `"`, `\n`, or `\r`.
 * Matches Python's `csv.QUOTE_MINIMAL` (the stdlib default).
 */
function csvEscape(v: string): string {
  if (/[",\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
