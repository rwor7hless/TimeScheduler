import { IsDateString } from 'class-validator';

/**
 * Body of POST /api/habits/:id/log. Python's `HabitLogToggle`
 * (`backend/app/schemas/habit.py` lines 21-22) uses `date: date`, parsed
 * as ISO-8601. `@IsDateString` accepts both `YYYY-MM-DD` and full ISO
 * timestamps; the service normalizes to a date-only value before hitting
 * Prisma's `@db.Date` column.
 */
export class HabitLogToggleDto {
  @IsDateString()
  date!: string;
}
