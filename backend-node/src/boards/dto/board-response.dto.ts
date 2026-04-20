/**
 * Response DTO for /api/boards. Mirrors Python's `BoardResponse`
 * (`backend/app/schemas/board.py`): the frontend reads `id`, `name`,
 * `created_at`, `updated_at`.
 *
 * NB: Python's `BoardResponse` does NOT expose `user_id` — it's a single-user
 * app on the wire, and SQLAlchemy's `from_attributes` only includes fields
 * declared on the Pydantic model. We preserve that shape here.
 */
export class BoardResponseDto {
  id!: number;
  name!: string;
  created_at!: string;
  updated_at!: string;
}
