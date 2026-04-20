import { IsOptional, IsString, Length, Matches } from 'class-validator';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/**
 * Body of POST /api/tags. Matches Python's `TagCreate`
 * (`backend/app/schemas/task.py` lines 18-20): `name` required, `color`
 * optional with default `#6B7280`. The DB column is `varchar(50)` for name
 * and `varchar(7)` for color; we enforce the hex pattern at the edge.
 */
export class TagCreateDto {
  @IsString()
  @Length(1, 50)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, { message: 'color must be a 6-digit hex string like #RRGGBB' })
  color?: string;
}
