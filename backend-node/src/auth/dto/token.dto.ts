/**
 * Response DTO for POST /api/auth/token. Field names are snake_case because
 * the React frontend reads them verbatim (see `context/AuthContext.tsx`).
 */
export class TokenDto {
  access_token!: string;
  token_type!: 'bearer';
}
