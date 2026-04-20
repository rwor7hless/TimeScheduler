import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Request DTO for PATCH /api/admin/users/:id. Python only exposes
 * `can_request_summary` as an editable field (see
 * `backend/app/schemas/admin.py`), so we mirror that exactly — widening
 * the surface is out of scope for Phase 2.
 */
export class UserUpdateDto {
  @IsOptional()
  @IsBoolean()
  can_request_summary?: boolean;
}
