/**
 * Response DTO for habit-log rows. Mirrors Python's `HabitLogResponse`
 * (`backend/app/schemas/habit.py` lines 25-31): {id, habit_id, date,
 * completed_at}.
 *
 * NB: the Python field is `completed_at`, NOT `created_at` — the DB column
 * is `completed_at Timestamptz`. `date` serializes as `YYYY-MM-DD` (no time
 * component), matching Pydantic's `date` field.
 */
export class HabitLogResponseDto {
  id!: number;
  habit_id!: number;
  date!: string;
  completed_at!: string;
}
