import { IsString, MinLength } from 'class-validator';

/**
 * Request DTO for POST /api/admin/users. Matches Python's `UserCreate`
 * schema (only username + password — other flags are set server-side).
 */
export class UserCreateDto {
  @IsString()
  @MinLength(1)
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
