import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Priority } from '@prisma/client';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/**
 * Body of POST /api/tasks and PUT /api/tasks/:id.
 *
 * Wire enum format is lowercase (`low`/`medium`/...), Prisma exposes
 * UPPERCASE member names. The service uppercases before hitting Prisma.
 */
export const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'] as const;
export type PriorityWire = (typeof PRIORITY_VALUES)[number];

export const PRIORITY_TO_PRISMA: Record<PriorityWire, Priority> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  urgent: 'URGENT',
};
export const PRIORITY_FROM_PRISMA: Record<Priority, PriorityWire> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

export class TaskCreateDto {
  @IsString()
  @Length(1, 255)
  title!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  description?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Matches(HEX_COLOR, { message: 'color must be a 6-digit hex string like #RRGGBB' })
  color?: string | null;

  @IsOptional()
  @IsEnum(PRIORITY_VALUES)
  priority?: PriorityWire;

  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  scheduled_start?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  scheduled_end?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  deadline?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @Type(() => Number)
  repeat_days?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  tag_ids?: number[];

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  board_id?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  parent_id?: number | null;

  @IsOptional()
  @IsBoolean()
  tg_remind?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  tg_remind_at?: string | null;

  @IsOptional()
  @IsBoolean()
  my_day?: boolean;
}
