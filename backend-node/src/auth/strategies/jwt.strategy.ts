import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { User } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Payload shape for tokens issued by `AuthService.createAccessToken`. Kept in
 * sync with the Python implementation, which puts `user_id` in the payload
 * alongside the `sub` (username) claim. Older Python tokens (from before
 * `user_id` was added) may lack that field — those still validate via the
 * username fallback below.
 */
interface JwtPayload {
  sub: string;
  user_id?: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('SECRET_KEY'),
      algorithms: ['HS256'],
    });
  }

  /**
   * Passport will populate `request.user` with whatever this returns. We load
   * the full Prisma `User` row so downstream handlers can read `is_admin`,
   * `can_request_summary`, etc. without a second DB hit.
   *
   * Lookup preference (matches Python `get_current_user`):
   *   1. `payload.user_id` — fast path, used by fresh tokens.
   *   2. `payload.sub` (username) — legacy fallback for tokens issued before
   *      the `user_id` claim was introduced.
   */
  async validate(payload: JwtPayload): Promise<User> {
    let user: User | null;
    if (typeof payload.user_id === 'number') {
      user = await this.prisma.user.findUnique({ where: { id: payload.user_id } });
    } else {
      user = await this.prisma.user.findUnique({ where: { username: payload.sub } });
    }
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
