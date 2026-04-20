import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StatsResponseDto } from './dto/stats-response.dto';
import { StatsService } from './stats.service';

const PERIOD_TO_DAYS: Record<string, number> = { week: 7, month: 30, year: 365 };
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `/api/stats` — ports `backend/app/routers/stats.py`. Query:
 *   - `period=week|month|year` (default `month`)
 *   - `week_start=YYYY-MM-DD` — when set, `period` is ignored and the
 *     service returns fixed-week metrics + previous-week deltas.
 */
@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  get(
    @CurrentUser() user: User,
    @Query('period') periodRaw?: string,
    @Query('week_start') weekStart?: string,
  ): Promise<StatsResponseDto> {
    const period = periodRaw ?? 'month';
    if (!(period in PERIOD_TO_DAYS)) {
      throw new BadRequestException('period must be one of week|month|year');
    }
    if (weekStart && !YMD_RE.test(weekStart)) {
      throw new BadRequestException('week_start must be YYYY-MM-DD');
    }
    const periodDays = PERIOD_TO_DAYS[period];
    return this.stats.getStats(user.id, {
      periodDays,
      weekStart: weekStart ?? null,
    });
  }
}
