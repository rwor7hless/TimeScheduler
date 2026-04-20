/**
 * Response DTO for /api/tags. Matches Python's `TagResponse` in
 * `backend/app/schemas/task.py` (lines 10-15): exactly {id, name, color}.
 * `user_id` is intentionally not exposed — Pydantic's
 * `model_config = {"from_attributes": True}` only serializes declared fields.
 */
export class TagResponseDto {
  id!: number;
  name!: string;
  color!: string;
}
