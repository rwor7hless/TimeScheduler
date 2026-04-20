import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { Request } from 'express';

/**
 * Requires `request.user.is_admin === true`. Always compose with
 * `JwtAuthGuard` first — this guard assumes `request.user` is populated.
 *
 * The error text matches the Python `get_admin_user` dependency ("Admin
 * access required") so frontend parity tests see the same string.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: User }>();
    const user = request.user;
    if (!user || !user.is_admin) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
