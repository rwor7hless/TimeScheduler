import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WeeklyBudgetInput } from '../../llm/prompts/weekly-report.prompt';
import { pad2, pad4 } from '../budget.utils';

/**
 * Ports `backend/app/services/budget_summary.py` `build_weekly_budget_block`.
 * Returns a block shaped for the weekly AI report prompt — keeps
 * top_categories/overspent as tuple-shaped arrays to match
 * `WeeklyBudgetInput` from the prompt module.
 */
@Injectable()
export class BudgetWeeklyService {
  constructor(private readonly prisma: PrismaService) {}

  private fmt(d: Date): string {
    return `${pad4(d.getUTCFullYear())}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }

  async buildWeeklyBlock(userId: number, weekEnd: Date): Promise<WeeklyBudgetInput> {
    const weekStart = new Date(
      Date.UTC(weekEnd.getUTCFullYear(), weekEnd.getUTCMonth(), weekEnd.getUTCDate() - 6),
    );
    const wStart = this.fmt(weekStart);
    const wEnd = this.fmt(weekEnd);

    const rows = await this.prisma.transaction.findMany({
      where: {
        user_id: userId,
        date: { gte: wStart, lte: wEnd },
      },
    });

    const totalExpense = rows.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalIncome = rows.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

    const byCat = new Map<string | null, number>();
    for (const t of rows) {
      if (t.type !== 'expense') continue;
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
    }
    const topCategories: Array<[string | null, number]> = [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Baseline: 4 previous weeks.
    const baselineStart = new Date(
      Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() - 28),
    );
    const baselineEnd = new Date(
      Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() - 1),
    );
    const baselineRows = await this.prisma.transaction.findMany({
      where: {
        user_id: userId,
        type: 'expense',
        date: { gte: this.fmt(baselineStart), lte: this.fmt(baselineEnd) },
      },
      select: { amount: true },
    });
    const baseline = baselineRows.reduce((s, r) => s + r.amount, 0);
    const avgPerWeek = baseline > 0 ? baseline / 4.0 : 0;
    let deltaPct: number | null = null;
    if (avgPerWeek > 0) {
      deltaPct = ((totalExpense - avgPerWeek) / avgPerWeek) * 100;
    }

    const month0 = weekEnd.getUTCMonth();
    const year = weekEnd.getUTCFullYear();
    const plannedRows = await this.prisma.plannedPurchase.findMany({
      where: { user_id: userId, year, month: month0 },
    });
    const plannedTotal = plannedRows.length;
    const plannedDone = plannedRows.filter((p) => p.done).length;

    const allocRows = await this.prisma.budgetAllocation.findMany({
      where: { user_id: userId, year, month: month0 },
    });
    const mStart = `${pad4(year)}-${pad2(month0 + 1)}-01`;
    const monthTxRows = await this.prisma.transaction.findMany({
      where: {
        user_id: userId,
        type: 'expense',
        date: { gte: mStart, lte: wEnd },
      },
    });
    const spentByCat = new Map<string | null, number>();
    for (const t of monthTxRows) {
      spentByCat.set(t.category, (spentByCat.get(t.category) ?? 0) + t.amount);
    }
    const overspent: Array<[string, number, number]> = [];
    for (const a of allocRows) {
      const spent = spentByCat.get(a.category) ?? 0;
      if (spent > a.limit_amount) {
        overspent.push([a.category, spent, a.limit_amount]);
      }
    }

    return {
      total_expense: totalExpense,
      total_income: totalIncome,
      top_categories: topCategories,
      avg_per_week: avgPerWeek,
      delta_pct: deltaPct,
      planned_done: plannedDone,
      planned_total: plannedTotal,
      overspent,
    };
  }
}
