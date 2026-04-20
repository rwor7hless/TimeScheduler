import { IsString, MinLength } from 'class-validator';

/**
 * OAuth2 password-flow form fields. Browsers post this as
 * `application/x-www-form-urlencoded`; Express parses it into `req.body` once
 * `express.urlencoded()` is mounted in main.ts.
 */
export class LoginDto {
  @IsString()
  @MinLength(1)
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
