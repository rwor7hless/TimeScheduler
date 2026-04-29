import { TagResponseDto } from '../../tags/dto/tag-response.dto';
import { PriorityWire } from './task-create.dto';

/**
 * Response DTO for all task endpoints. Mirrors Python's `TaskResponse` in
 * `backend/app/schemas/task.py` (lines 81-106). Key parity points:
 *
 * - Enums serialize to lowercase strings (Pydantic uses the `str` value of
 *   `Priority`/`KanbanStatus`), NOT Prisma's UPPERCASE member names.
 * - `subtasks` defaults to `[]` even when subtasks aren't eagerly loaded —
 *   Pydantic's `from_attributes=True` + `list[...] = []` makes the field
 *   always present. The frontend type (`Task.subtasks: Task[]`) also
 *   expects it always present.
 * - `tags` is a flat array of `{id, name, color}` — we flatten from the
 *   `task_tags[].tag` Prisma include.
 * - `repeat_days` can be `null` (Python collapses empty → NULL). Prisma
 *   scalar lists return `[]` for NULL, so the service normalizes `[]` → `null`
 *   on the way out to preserve Python parity.
 * - `completed_at`, `scheduled_*`, `deadline`, `tg_remind_at` are
 *   ISO-8601 strings with offset, or `null`.
 */
export class TaskResponseDto {
  id!: number;
  title!: string;
  color!: string;
  description!: string | null;
  priority!: PriorityWire;
  done!: boolean;
  position!: number;
  scheduled_start!: string | null;
  scheduled_end!: string | null;
  deadline!: string | null;
  repeat_days!: number[] | null;
  completed_at!: string | null;
  created_at!: string;
  updated_at!: string;
  tags!: TagResponseDto[];
  board_id!: number | null;
  parent_id!: number | null;
  is_archived!: boolean;
  tg_remind!: boolean;
  tg_remind_at!: string | null;
  tg_reminded!: boolean;
  my_day!: boolean;
  subtasks!: TaskResponseDto[];
}
