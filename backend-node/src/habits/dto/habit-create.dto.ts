import { IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/**
 * Body of POST /api/habits. Matches Python's `HabitCreate`
 * (`backend/app/schemas/habit.py` lines 8-11): `name` required (max 255),
 * `description` optional nullable, `color` optional hex string (default
 * `#10B981`).
 */
export class HabitCreateDto {
  @IsString()
  @Length(1, 255)
  name!: string;

  // Python's `description: str | None = None` accepts null explicitly — the
  // DB column is nullable varchar(500). `@ValidateIf` skips the @IsString
  // check when null is sent so the frontend's `null` payload passes.
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Length(0, 500)
  description?: string | null;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'color must be a 6-digit hex string like #RRGGBB' })
  color?: string;
}
