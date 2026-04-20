import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsEnum, IsInt } from 'class-validator';
import { KANBAN_STATUS_VALUES, KanbanStatusWire } from './task-create.dto';

/**
 * Body of PATCH /api/tasks/reorder. Mirrors Python's `KanbanReorder`
 * (`backend/app/schemas/task.py` lines 109-111). Note that Python accepts
 * an empty `ordered_ids` list and short-circuits to `{ok: true}` — we
 * mirror that in the service. The `@ArrayNotEmpty` constraint is NOT
 * applied here for exactly that reason.
 */
export class KanbanReorderDto {
  @IsEnum(KANBAN_STATUS_VALUES)
  status!: KanbanStatusWire;

  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  ordered_ids!: number[];
}

// `ArrayNotEmpty` import retained but unused — keep the tree-shake warning
// silent if the rule fires. (Removing is also fine.)
void ArrayNotEmpty;
