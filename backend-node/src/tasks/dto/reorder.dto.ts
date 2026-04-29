import { Type } from 'class-transformer';
import { IsArray, IsInt } from 'class-validator';

/**
 * Body of PATCH /api/tasks/reorder. Accepts the new full ordering of one
 * "section" as a flat list of task ids. The service writes `position = i`
 * for each id in array order, transactionally. An empty array short-circuits
 * to `{ ok: true }`.
 */
export class ReorderDto {
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  ordered_ids!: number[];
}
