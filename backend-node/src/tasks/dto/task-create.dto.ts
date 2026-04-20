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
import { KanbanStatus, Priority } from '@prisma/client';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/**
 * Body of POST /api/tasks and PUT /api/tasks/:id. Mirrors Python's
 * `TaskCreate` in `backend/app/schemas/task.py` (lines 23-49).
 *
 * Python's enum values are lowercase strings (`low`/`medium`/..., `todo`
 * /`in_progress`/`done`), while Prisma's enum type exposes UPPERCASE member
 * names (`LOW`, `TODO`, ...). The wire format from the frontend is the
 * lowercase Python form — we accept both via a lowercase-only enum check
 * plus a transformer that uppercases before Prisma sees it. Here we only
 * validate that the wire value matches one of the lowercase members; the
 * service uppercases before hitting Prisma.
 */
export const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'] as const;
export const KANBAN_STATUS_VALUES = ['todo', 'in_progress', 'done'] as const;
export type PriorityWire = (typeof PRIORITY_VALUES)[number];
export type KanbanStatusWire = (typeof KANBAN_STATUS_VALUES)[number];

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
export const KANBAN_TO_PRISMA: Record<KanbanStatusWire, KanbanStatus> = {
  todo: 'TODO',
  in_progress: 'IN_PROGRESS',
  done: 'DONE',
};
export const KANBAN_FROM_PRISMA: Record<KanbanStatus, KanbanStatusWire> = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
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
