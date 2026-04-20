/**
 * Sparse metrics for the previous period of the same length, returned only
 * when the caller explicitly requests a specific `week_start`. Used for
 * delta badges in the Week-mode hero band on the Stats page.
 *
 * Matches `PreviousPeriodMetrics` in `backend/app/schemas/stats.py`.
 */
export class PreviousPeriodMetricsDto {
  completed_count!: number;
  productivity_percent!: number | null;
  active_days!: number;
  habits_done_pct!: number | null;
}
