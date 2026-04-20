import { IsString, Length } from 'class-validator';

/**
 * Body of PATCH /api/boards/:id. Python's `BoardUpdate` treats `name` as
 * optional, but the frontend always sends it (see
 * `frontend/src/api/boards.ts`). Keep it required at the DTO level so an
 * empty PATCH is rejected as 422 rather than silently succeeding.
 */
export class BoardUpdateDto {
  @IsString()
  @Length(1, 100)
  name!: string;
}
