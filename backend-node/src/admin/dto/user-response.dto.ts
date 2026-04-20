/**
 * Response DTO for the admin user endpoints. Field order and names match
 * the Python `UserResponse` schema — the React frontend reads these by name
 * (see `frontend/src/api/admin.ts`).
 *
 * `created_at` is serialized as an ISO-8601 string, same as Python's
 * `user.created_at.isoformat()`. Prisma returns a JS Date; the service layer
 * calls `.toISOString()` when building this DTO.
 */
export class UserResponseDto {
  id!: number;
  username!: string;
  is_admin!: boolean;
  can_request_summary!: boolean;
  created_at!: string;
}
