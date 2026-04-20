import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ports the `CLEAN_DB_ON_STARTUP` branch from `backend/app/main.py`'s
 * `lifespan` context manager. When the env var is exactly `'true'`
 * (case-insensitive), logs a warning, sleeps 3 seconds as a grace
 * period, and then TRUNCATEs every table in the `public` schema with
 * `RESTART IDENTITY CASCADE`.
 *
 * Excluded tables (CRITICAL):
 *   - `_prisma_migrations` — truncating would confuse Prisma's migrator.
 *   - `alembic_version`    — the legacy Python backend still reads this
 *     while the two run in parallel during the port.
 *
 * Must run before any other `OnApplicationBootstrap` provider so that
 * later bootstrap work (stuck-reports recovery, admin user seeding)
 * operates on the already-cleaned database.
 */
@Injectable()
export class CleanDbService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CleanDbService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const flag = this.configService.get<string>('CLEAN_DB_ON_STARTUP');
    if (!flag || flag.toLowerCase() !== 'true') {
      this.logger.debug('CLEAN_DB_ON_STARTUP=false, skipping');
      return;
    }

    this.logger.warn(
      '\u26A0  CLEAN_DB_ON_STARTUP=true — truncating all public tables in 3s. ' +
        'Ctrl+C now if this was not intended.',
    );
    await this.sleep(3000);

    const rows = await this.prisma.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN ('_prisma_migrations', 'alembic_version')`,
    );

    if (rows.length === 0) {
      this.logger.warn('CLEAN_DB_ON_STARTUP: no public tables found to truncate');
      return;
    }

    const quoted = rows.map((r) => `"${r.tablename.replace(/"/g, '""')}"`).join(', ');
    await this.prisma.$executeRawUnsafe(`TRUNCATE ONLY ${quoted} RESTART IDENTITY CASCADE`);

    this.logger.warn(
      `\u2713 CLEAN_DB_ON_STARTUP: truncated ${rows.length} public table(s), sequences reset`,
    );
  }

  // Indirection so tests can spy/stub without actually waiting 3s.
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
