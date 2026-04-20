/**
 * Response DTO for GET /api/auth/me. Field names are snake_case to match
 * the Python backend's `UserInfo` schema and the frontend contract in
 * `frontend/src/context/AuthContext.tsx`.
 */
export class UserInfoDto {
  username!: string;
  user_id!: number;
  is_admin!: boolean;
  can_request_summary!: boolean;
}
