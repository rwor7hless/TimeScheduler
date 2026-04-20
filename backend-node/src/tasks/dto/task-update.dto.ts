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
import {
  KANBAN_STATUS_VALUES,
  KanbanStatusWire,
  PRIORITY_VALUES,
  PriorityWire,
} from './task-create.dto';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/**
 * Body of PATCH /api/tasks/:id. Mirrors Python's `TaskUpdate` in
 * `backend/app/schemas/task.py` (lines 52-78): every field is optional.
 * The service layer uses "was this key explicitly sent" semantics to mimic
 * Pydantic's `exclude_unset=True`; we do that by passing the raw body
 * through `Object.keys(body)` — class-validator/class-transformer only
 * attach keys that the caller actually sent because of `whitelist: true`
 * + `forbidNonWhitelisted: false` in main.ts.
 *
 * Distinction from `TaskCreateDto`: `repeat_days` here is nullable on the
 * wire (caller can explicitly send `null` to clear).
 */
export class TaskUpdateDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  title?: string;

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
  @IsEnum(KANBAN_STATUS_VALUES)
  status?: KanbanStatusWire;

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
  @ValidateIf((_, v) => v !== null)
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @Type(() => Number)
  repeat_days?: number[] | null;

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
  @ValidateIf((_, v) => v !== null)
  @IsBoolean()
  tg_remind?: boolean | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  tg_remind_at?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsBoolean()
  my_day?: boolean | null;
}
