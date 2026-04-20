import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RecurringTransaction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { daysInMonth, pad2, pad4 } from '../budget.utils';

/**
 * Ports `backend/app/services/budget_recurring.py`. Runs every day at 00:15
 * in Europe/Moscow. For each non-paused template, materializes missing
 * transactions up to today, clamping `day_of_month` to the last day of
 * short months. Idempotent: each generation advances `last_generated_date`,
 * and an existing-transaction probe avoids double-insert on restart.
 */
@Injectable()
export class BudgetRecurringJobService {
  private readonly logger = new Logger(BudgetRecurringJobService.name);
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron('15 0 * * *', { name: 'budget-recurring', timeZone: 'Europe/Moscow' })
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('budget-recurring cron already running — skipping tick.');
      return;
    }
    this.isRunning = true;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const templates = await this.prisma.recurringTransaction.findMany({
        where: { is_paused: false },
      });
      let created = 0;
      for (const tpl of templates) {
        try {
          created += await this.generateForTemplate(tpl, today);
        } catch (err) {
          this.logger.error(`recurring: failed to process template id=${tpl.id}: ${String(err)}`);
        }
      }
      if (created > 0) {
        this.logger.log(`recurring: generated ${created} transactions`);
      }
    } finally {
      this.isRunning = false;
    }
  }

  async generateForTemplate(tpl: RecurringTransaction, today: Date): Promise<number> {
    const todayStr = this.fmt(today);
    let cursorY: number;
    let cursorM1: number;
    if (tpl.last_generated_date) {
      const [ly, lm] = parseIso(tpl.last_generated_date);
      if (lm < 12) {
        cursorY = ly;
        cursorM1 = lm + 1;
      } else {
        cursorY = ly + 1;
        cursorM1 = 1;
      }
    } else {
      const [sy, sm] = parseIso(tpl.start_date);
      cursorY = sy;
      cursorM1 = sm;
    }
    const end = tpl.end_date ? tpl.end_date : null;

    let created = 0;
    // Guard cap: Python sets `cursor_y > today.year + 1` as the break
    // condition inside the loop. Use the same as our `while` predicate so
    // ESLint's no-constant-condition stays happy.
    const yearCap = today.getFullYear() + 2;
    while (cursorY < yearCap) {
      const day = Math.min(tpl.day_of_month, daysInMonth(cursorY, cursorM1));
      const target = `${pad4(cursorY)}-${pad2(cursorM1)}-${pad2(day)}`;
      if (target > todayStr) break;
      if (end && target > end) break;

      // Probe: skip if a matching transaction already exists.
      const existing = await this.prisma.transaction.findFirst({
        where: {
          user_id: tpl.user_id,
          date: target,
          source_planned_id: null,
          amount: tpl.amount,
          description: tpl.description,
          category: tpl.category,
        },
      });
      if (!existing) {
        const validTagIds =
          tpl.tag_ids && tpl.tag_ids.length > 0
            ? (
                await this.prisma.budgetTag.findMany({
                  where: { id: { in: tpl.tag_ids }, user_id: tpl.user_id },
                  select: { id: true },
                })
              ).map((r) => r.id)
            : [];
        await this.prisma.transaction.create({
          data: {
            user_id: tpl.user_id,
            type: tpl.type,
            amount: tpl.amount,
            category: tpl.category,
            description: tpl.description,
            date: target,
            created_at: new Date(),
            transaction_tags: {
              create: validTagIds.map((tid) => ({ tag_id: tid })),
            },
          },
        });
        created += 1;
      }

      await this.prisma.recurringTransaction.update({
        where: { id: tpl.id },
        data: { last_generated_date: target },
      });

      if (cursorM1 === 12) {
        cursorY += 1;
        cursorM1 = 1;
      } else {
        cursorM1 += 1;
      }
      // loop predicate (cursorY < yearCap) handles the upper-bound break.
    }
    return created;
  }

  private fmt(d: Date): string {
    return `${pad4(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
}

function parseIso(s: string): [number, number, number] {
  // "YYYY-MM-DD" → [year, month1, day]
  return [Number(s.slice(0, 4)), Number(s.slice(5, 7)), Number(s.slice(8, 10))];
}
