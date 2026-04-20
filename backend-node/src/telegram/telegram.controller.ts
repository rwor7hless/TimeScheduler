import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectDto } from './dto/connect.dto';

export interface TelegramStatusDto {
  connected: boolean;
}

/**
 * `/api/telegram` — ports `backend/app/routers/telegram.py`.
 *
 *  - `GET /status`         → `{connected}` based on `user.telegram_chat_id`.
 *  - `POST /connect`       → binds `user.telegram_chat_id = tgkey.chat_id`
 *                             and deletes the consumed key.
 *  - `DELETE /connect`     → clears both `telegram_chat_id` and
 *                             `telegram_key`.
 *
 * The webhook endpoint lives in `telegram-webhook.controller.ts` — no JWT,
 * guarded by the Telegram shared secret instead.
 */
@Controller('telegram')
@UseGuards(JwtAuthGuard)
export class TelegramController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('status')
  status(@CurrentUser() user: User): TelegramStatusDto {
    return { connected: Boolean(user.telegram_chat_id) };
  }

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async connect(@CurrentUser() user: User, @Body() body: ConnectDto): Promise<TelegramStatusDto> {
    const tgKey = await this.prisma.telegramKey.findUnique({ where: { key: body.key } });
    if (!tgKey) {
      // Python returns 404 with this exact detail string — keep verbatim.
      throw new NotFoundException('Ключ не найден. Проверьте правильность.');
    }

    // Python does all three in one transaction: update user, delete key, commit.
    // Prisma transaction keeps the semantics atomic.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { telegram_chat_id: tgKey.chat_id, telegram_key: body.key },
      }),
      this.prisma.telegramKey.delete({ where: { id: tgKey.id } }),
    ]);

    return { connected: true };
  }

  @Delete('connect')
  @HttpCode(HttpStatus.OK)
  async disconnect(@CurrentUser() user: User): Promise<TelegramStatusDto> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { telegram_chat_id: null, telegram_key: null },
    });
    return { connected: false };
  }
}
