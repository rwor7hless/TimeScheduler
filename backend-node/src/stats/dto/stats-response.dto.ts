import { BreakdownItemDto } from './breakdown-item.dto';
import { DailyCompletionDto } from './daily-completion.dto';
import { HabitProgressDto } from './habit-progress.dto';
import { PreviousPeriodMetricsDto } from './previous-period-metrics.dto';

/**
 * The full Stats response. Matches `StatsResponse` in
 * `backend/app/schemas/stats.py` field-for-field.
 *
 * `week_start` is echoed back (YYYY-MM-DD) so the frontend trusts the
 * server-computed Monday over its local timezone calculation.
 */
export class StatsResponseDto {
  active_tasks!: number;
  completed_last_month!: number;
  overdue_count!: number;
  avg_completion_hours!: number | null;
  productivity_percent!: number | null;
  most_active_hours!: number[];
  habit_progress!: HabitProgressDto[];
  daily_completions!: DailyCompletionDto[];
  by_priority!: BreakdownItemDto[];
  by_board!: BreakdownItemDto[];
  by_tag!: BreakdownItemDto[];
  week_start!: string | null; // YYYY-MM-DD
  previous_period_metrics!: PreviousPeriodMetricsDto | null;
}
