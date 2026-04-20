import { IsBoolean, IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/**
 * Body of PUT /api/habits/:id. Matches Python's `HabitUpdate`
 * (`backend/app/schemas/habit.py` lines 14-18): every field optional, with
 * `is_active` toggling active/archived. Python uses `exclude_unset=True`,
 * so only fields the caller actually sent land in the UPDATE — we mirror
 * that by letting class-validator strip undefined keys and then copying
 * only defined keys into Prisma's `data`.
 */
export class HabitUpdateDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Length(0, 500)
  description?: string | null;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'color must be a 6-digit hex string like #RRGGBB' })
  color?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
