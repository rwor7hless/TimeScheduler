/**
 * Mirrors `BreakdownItem` in `backend/app/schemas/stats.py`. Used inside
 * `StatsResponse` for priority / board / tag breakdowns.
 */
export class BreakdownItemDto {
  label!: string;
  count!: number;
  color!: string | null;
}
