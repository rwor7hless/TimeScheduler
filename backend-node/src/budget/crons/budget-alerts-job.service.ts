import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { NtfyService } from '../../ntfy/ntfy.service';
import { PrismaService } from '../../prisma/prisma.service';
import { monthRange0 } from '../budget.utils';

const THRESHOLDS = [80, 100, 120];

/**
 * Ports `backend/app/services/budget_alerts.py`. Iterates every user, for
 * each allocation of the current month computes spent, and pushes an ntfy
 * alert for any never-sent threshold crossing. Dedupe is enforced by the
 * `(user, year, month, category, threshold)` unique on `BudgetAlertLog`.
 */
@Injectable()
export class BudgetAlertsJobService {
  private readonly logger = new Logger(BudgetAlertsJobService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ntfy: NtfyService,
  ) {}

  @Cron('0 10,20 * * *', { name: 'budget-alerts', timeZone: 'Europe/Moscow' })
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('budget-alerts cron already running — skipping tick.');
      return;
    }
    this.isRunning = true;
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month0 = now.getMonth();

      const users = await this.prisma.user.findMany();
      for (const user of users) {
        const allocs = await this.prisma.budgetAllocation.findMany({
          where: { user_id: user.id, year, month: month0 },
        });
        for (const alloc of allocs) {
          if (alloc.limit_amount <= 0) continue;
          const spent = await this.monthSpent(user.id, year, month0, alloc.category);
          const pct = (spent / alloc.limit_amount) * 100;
          for (const threshold of THRESHOLDS) {
            if (pct < threshold) continue;
            const existing = await this.prisma.budgetAlertLog.findFirst({
              where: {
                user_id: user.id,
                year,
                month: month0,
                category: alloc.category,
                threshold,
              },
            });
            if (existing) continue;
            try {
              await this.sendAlert(alloc.category, spent, alloc.limit_amount, threshold);
            } catch (err) {
              this.logger.error(`sendAlert failed: ${String(err)}`);
              continue;
            }
            try {
              await this.prisma.budgetAlertLog.create({
                data: {
                  user_id: user.id,
                  year,
                  month: month0,
                  category: alloc.category,
                  threshold,
                  sent_at: new Date(),
                },
              });
            } catch (err) {
              if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                // concurrent insert — ignore
                continue;
              }
              throw err;
            }
          }
        }
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async monthSpent(
    userId: number,
    year: number,
    month0: number,
    category: string,
  ): Promise<number> {
    const { start, end } = monthRange0(year, month0);
    const rows = await this.prisma.transaction.findMany({
      where: {
        user_id: userId,
        type: 'expense',
        category,
        date: { gte: start, lte: end },
      },
      select: { amount: true },
    });
    return rows.reduce((s, r) => s + r.amount, 0);
  }

  private async sendAlert(
    category: string,
    spent: number,
    limit: number,
    threshold: number,
  ): Promise<void> {
    const pct = limit > 0 ? Math.trunc((spent / limit) * 100) : threshold;
    let message: string;
    let priority: 'default' | 'high';
    if (threshold === 80) {
      message = `Уже ${pct}% лимита «${category}» — осталось ${Math.trunc(limit - spent)} ₽.`;
      priority = 'default';
    } else if (threshold === 100) {
      message = `Лимит «${category}» потрачен полностью (${Math.trunc(spent)} из ${Math.trunc(limit)} ₽).`;
      priority = 'high';
    } else {
      message = `Перерасход «${category}»: ${Math.trunc(spent)} из ${Math.trunc(limit)} ₽ (+${pct - 100}% сверх).`;
      priority = 'high';
    }
    const title = `Бюджет: ${category} ${pct}%`;
    await this.ntfy.send(title, message, { priority, tags: ['warning'] });
  }
}
