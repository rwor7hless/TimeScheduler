import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { User } from '@prisma/client';
import { Request } from 'express';

/**
 * `@CurrentUser()` injects the Prisma `User` row that Passport wrote to
 * `request.user` via `JwtStrategy.validate()`. Routes that use this decorator
 * must have `JwtAuthGuard` applied — otherwise `request.user` will be
 * undefined.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  const req = ctx.switchToHttp().getRequest<Request & { user: User }>();
  return req.user;
});
