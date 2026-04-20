import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Thin wrapper around Passport's 'jwt' strategy. Applied to every route that
 * needs an authenticated user (see `AuthController.me()`, `AdminController`,
 * and future domain controllers).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
