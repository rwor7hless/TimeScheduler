import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: { url: process.env.DATABASE_URL_PRISMA ?? process.env.DATABASE_URL },
      },
      log: [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
