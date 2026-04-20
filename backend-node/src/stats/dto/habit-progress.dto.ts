/**
 * Per-habit progress inside the stats response. Matches `HabitProgress`
 * in `backend/app/schemas/stats.py`.
 *
 * `days` length equals the window length (7 for week mode, `period_days`
 * otherwise). Chronological: oldest → newest; for week_start, Monday → Sunday.
 * `current_streak` is calculated independently of the window (always back
 * from today).
 */
export class HabitProgressDto {
  habit_id!: number;
  name!: string;
  completion_rate!: number;
  current_streak!: number;
  days!: boolean[];
}
