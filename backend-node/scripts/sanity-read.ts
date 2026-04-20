/**
 * Phase 1 sanity check — prove the whole pipeline (env → Prisma client → live DB) works by
 * reading row counts from a few flagship tables. If this prints real (non-zero) counts
 * without throwing, the baseline is trustworthy.
 *
 * Run from `backend-node/`:
 *   npx ts-node --transpile-only scripts/sanity-read.ts
 */
import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';

// `.env` lives at the worktree root (one level above backend-node/). Load it explicitly —
// ts-node doesn't pick it up the way NestFactory does.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_PRISMA ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Neither DATABASE_URL_PRISMA nor DATABASE_URL is set');
  }

  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });

  try {
    const [users, tasks, reports, habits, transactions, boards] = await Promise.all([
      prisma.user.count(),
      prisma.task.count(),
      prisma.weeklyReport.count(),
      prisma.habit.count(),
      prisma.transaction.count(),
      prisma.board.count(),
    ]);

    // Pull one user (if present) to prove reads work, not just aggregate SQL.
    const firstUser = await prisma.user.findFirst({
      select: { id: true, username: true, is_admin: true },
      orderBy: { id: 'asc' },
    });

    console.log(
      JSON.stringify(
        { counts: { users, tasks, reports, habits, transactions, boards }, firstUser },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
