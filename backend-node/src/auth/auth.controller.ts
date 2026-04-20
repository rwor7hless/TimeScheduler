import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { TokenDto } from './dto/token.dto';
import { UserInfoDto } from './dto/user-info.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Auth endpoints. Routes are prefixed with the `/api` global prefix set in
 * `main.ts`, so the final paths are `/api/auth/token` and `/api/auth/me`.
 *
 * The token endpoint consumes `application/x-www-form-urlencoded` bodies to
 * match Python's `OAuth2PasswordRequestForm`. Express must be configured with
 * `express.urlencoded()` (wired in `main.ts`) for the DTO to populate.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto): Promise<TokenDto> {
    const user = await this.authService.validateUser(body.username, body.password);
    if (!user) {
      // Python returns 401 with detail "Incorrect username or password". The
      // React frontend only inspects `response.data.access_token` for success
      // and never reads the error body (it shows its own Russian toast), so
      // the exact English text matches Python 1:1.
      throw new UnauthorizedException('Incorrect username or password');
    }
    const access_token = await this.authService.createAccessToken(user.id, user.username);
    return { access_token, token_type: 'bearer' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: User): Promise<UserInfoDto> {
    return {
      username: user.username,
      user_id: user.id,
      is_admin: user.is_admin,
      can_request_summary: user.can_request_summary,
    };
  }
}
