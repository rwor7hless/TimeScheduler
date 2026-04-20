import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Thin PrismaClient wrapper wired into Nest's lifecycle.
 *
 * The URL resolution order is intentional:
 *   1. `DATABASE_URL_PRISMA` — the plain `postgresql://` string we added to `.env` for
 *      Prisma. Prefer this.
 *   2. `DATABASE_URL` — fallback. The Python backend uses `postgresql+asyncpg://...`,
 *      which Prisma can't parse. If only `DATABASE_URL` is set it must already be the
 *      plain form (e.g. in a fresh deploy where Python is gone).
 */

/**
 * Resolve the DB URL for PrismaClient, or throw a clear error. Extracted as a
 * free function because `super(...)` must be the first statement in the
 * constructor — we can't check + throw on a local `const` before `super`.
 */
function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_PRISMA ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'PrismaService: neither DATABASE_URL_PRISMA nor DATABASE_URL is set. ' +
        'Populate the repo-root .env (or backend-node/../.env in the worktree).',
    );
  }
  return url;
}

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'warn' | 'error'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: { db: { url: resolveDatabaseUrl() } },
      // Emit warn/error as events so we can pipe them through the Nest Logger
      // in onModuleInit (instead of Prisma's stdout logger).
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    // Wire Prisma log events to the Nest Logger so warnings/errors actually surface.
    this.$on('warn', (e) => this.logger.warn(e.message ?? e));
    this.$on('error', (e) => this.logger.error(e.message ?? e));
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
