import { HabitLogResponseDto } from './habit-log-response.dto';

/**
 * Response DTO for /api/habits. Matches Python's `HabitResponse`
 * (`backend/app/schemas/habit.py` lines 34-43): {id, name, description,
 * color, is_active, created_at, logs}.
 *
 * `user_id` is NOT exposed — Pydantic `from_attributes=True` only serializes
 * declared fields. `logs` eagerly ships with every habit row; Python uses
 * `selectinload(Habit.logs)` (habits.py line 31) and we mirror that with
 * Prisma's `include: {logs: true}`.
 */
export class HabitResponseDto {
  id!: number;
  name!: string;
  description!: string | null;
  color!: string;
  is_active!: boolean;
  created_at!: string;
  logs!: HabitLogResponseDto[];
}
