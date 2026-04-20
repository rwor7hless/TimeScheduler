import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ports the admin-user lifecycle block from `backend/app/main.py`'s `lifespan`
 * context manager. Runs once on application bootstrap:
 *
 *   - If no user exists with `USER_LOGIN`, create one with the env-supplied
 *     password and `is_admin=true`.
 *   - If the user exists but `USER_PASSWORD` no longer verifies against the
 *     stored hash, rehash and persist (also re-asserting `is_admin=true`).
 *   - Otherwise, log a single "unchanged" line and exit.
 *
 * CLEAN_DB_ON_STARTUP is explicitly NOT handled here — that's Phase 6's scope.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const login = this.configService.get<string>('USER_LOGIN');
    const password = this.configService.get<string>('USER_PASSWORD');

    if (!login || !password) {
      this.logger.warn(
        'USER_LOGIN or USER_PASSWORD missing — skipping admin bootstrap. ' +
          'Set both in .env to enable auto-provisioning.',
      );
      return;
    }

    const admin = await this.prisma.user.findUnique({ where: { username: login } });

    if (admin === null) {
      const password_hash = await this.authService.hashPassword(password);
      await this.prisma.user.create({
        data: {
          username: login,
          password_hash,
          is_admin: true,
        },
      });
      this.logger.log(`Created admin user '${login}' from environment.`);
      return;
    }

    const passwordMatches = await this.authService.verifyPassword(password, admin.password_hash);
    if (!passwordMatches) {
      const password_hash = await this.authService.hashPassword(password);
      await this.prisma.user.update({
        where: { id: admin.id },
        // Also re-assert is_admin=true — matches Python which sets this on the
        // "password changed" branch. Safety net in case a manual DB edit flipped it.
        data: { password_hash, is_admin: true },
      });
      this.logger.warn(
        `Admin user '${login}' exists but USER_PASSWORD differs — updating password hash.`,
      );
      return;
    }

    this.logger.log(`Admin user '${login}' exists and password unchanged.`);
  }
}
