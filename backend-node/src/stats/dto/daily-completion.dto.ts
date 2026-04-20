/**
 * One row per calendar day with at least one completion inside the window.
 * Matches `DailyCompletion` in `backend/app/schemas/stats.py`. The `date`
 * field is a plain `YYYY-MM-DD` string because Pydantic serializes `date`
 * that way on the wire.
 */
export class DailyCompletionDto {
  date!: string; // YYYY-MM-DD
  count!: number;
}
