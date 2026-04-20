import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SummaryCategoryDto,
  SummaryDayDto,
  SummaryProjectionDto,
  SummaryResponseDto,
  SummaryTotalsDto,
  SummaryTrendDto,
} from '../dto/summary.dto';
import { monthRange0, pad2, pad4, prevMonth0 } from '../budget.utils';

/**
 * Ports `backend/app/services/budget_summary.py` `build_summary` (line-for-line).
 * Keeps the exact sort key for `by_category`: `(category === null, -spent)` —
 * nulls LAST, and within the non-null group, descending by spent.
 *
 * Float precision uses IEEE 754 double, matching Python exactly for the
 * arithmetic in this file. No `Decimal` or rounding needed; the DTO carries
 * raw JS number values (the frontend handles display rounding).
 */
@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Override in tests to freeze "today". */
  protected now(): Date {
    return new Date();
  }

  private async sumExpense(userId: number, start: string, end: string): Promise<number> {
    const rows = await this.prisma.transaction.findMany({
      where: {
        user_id: userId,
        type: 'expense',
        date: { gte: start, lte: end },
      },
      select: { amount: true },
    });
    return rows.reduce((s, r) => s + r.amount, 0);
  }

  async build(userId: number, year: number, month0: number): Promise<SummaryResponseDto> {
    const { start: prefixStart, end: prefixEnd, daysTotal } = monthRange0(year, month0);

    const txRows = await this.prisma.transaction.findMany({
      where: {
        user_id: userId,
        date: { gte: prefixStart, lte: prefixEnd },
      },
    });

    const plannedRows = await this.prisma.plannedPurchase.findMany({
      where: { user_id: userId, year, month: month0 },
    });

    const allocRows = await this.prisma.budgetAllocation.findMany({
      where: { user_id: userId, year, month: month0 },
    });

    // ── Totals ──────────────────────────────────────────────────────────
    const totalIncome = txRows.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = txRows
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const plannedPending = plannedRows.filter((p) => !p.done).reduce((s, p) => s + p.amount, 0);
    const plannedDone = plannedRows.filter((p) => p.done).reduce((s, p) => s + p.amount, 0);

    const totals: SummaryTotalsDto = {
      income: totalIncome,
      expense: totalExpense,
      balance: totalIncome - totalExpense,
      planned_pending: plannedPending,
      planned_done: plannedDone,
    };

    // ── By category ─────────────────────────────────────────────────────
    const spentByCat = new Map<string | null, number>();
    for (const t of txRows) {
      if (t.type !== 'expense') continue;
      spentByCat.set(t.category, (spentByCat.get(t.category) ?? 0) + t.amount);
    }

    const plannedByCat = new Map<string | null, number>();
    for (const p of plannedRows) {
      if (p.done) continue;
      plannedByCat.set(p.category, (plannedByCat.get(p.category) ?? 0) + p.amount);
    }

    const allocByCat = new Map<string, number>();
    for (const a of allocRows) {
      allocByCat.set(a.category, a.limit_amount);
    }

    const allCats = new Set<string | null>([
      ...spentByCat.keys(),
      ...plannedByCat.keys(),
      ...allocByCat.keys(),
    ]);

    const byCategory: SummaryCategoryDto[] = [];
    for (const cat of allCats) {
      const allocated = cat !== null ? (allocByCat.get(cat) ?? 0) : 0;
      const spent = spentByCat.get(cat) ?? 0;
      const pending = plannedByCat.get(cat) ?? 0;
      const remaining = allocated ? allocated - spent - pending : 0;
      const pct = allocated > 0 ? (spent / allocated) * 100 : 0;
      byCategory.push({
        category: cat,
        allocated,
        spent,
        planned_pending: pending,
        remaining,
        pct,
      });
    }
    // Python: sort key = (c.category is None, -c.spent) — nulls last,
    // descending by spent within each group.
    byCategory.sort((a, b) => {
      const aNull = a.category === null ? 1 : 0;
      const bNull = b.category === null ? 1 : 0;
      if (aNull !== bNull) return aNull - bNull;
      return -a.spent - -b.spent;
    });

    // ── Daily breakdown ─────────────────────────────────────────────────
    const dailyMap = new Map<string, { expense: number; income: number }>();
    for (let d = 1; d <= daysTotal; d++) {
      const key = `${pad4(year)}-${pad2(month0 + 1)}-${pad2(d)}`;
      dailyMap.set(key, { expense: 0, income: 0 });
    }
    for (const t of txRows) {
      const bucket = dailyMap.get(t.date) ?? { expense: 0, income: 0 };
      if (t.type === 'expense') bucket.expense += t.amount;
      else bucket.income += t.amount;
      dailyMap.set(t.date, bucket);
    }
    const daily: SummaryDayDto[] = [...dailyMap.keys()].sort().map((k) => ({
      date: k,
      expense: dailyMap.get(k)!.expense,
      income: dailyMap.get(k)!.income,
    }));

    // ── Trend vs previous month ─────────────────────────────────────────
    const [prevY, prevM] = prevMonth0(year, month0);
    const { start: prevStart, end: prevEnd } = monthRange0(prevY, prevM);
    const prevExpense = await this.sumExpense(userId, prevStart, prevEnd);
    const deltaAbs = totalExpense - prevExpense;
    const deltaPct = prevExpense > 0 ? (deltaAbs / prevExpense) * 100 : null;
    const trend: SummaryTrendDto = {
      prev_expense: prevExpense,
      delta_abs: deltaAbs,
      delta_pct: deltaPct,
    };

    // ── Projection ──────────────────────────────────────────────────────
    const today = this.now();
    const currentY = today.getFullYear();
    const currentM0 = today.getMonth();

    const cmpCur = compareYm([year, month0], [currentY, currentM0]);
    let daysPassed: number;
    if (cmpCur === 0) daysPassed = today.getDate();
    else if (cmpCur < 0) daysPassed = daysTotal;
    else daysPassed = 0;

    const daysLeft = Math.max(0, daysTotal - daysPassed);
    const ratePerDay = daysPassed > 0 ? totalExpense / daysPassed : 0;
    const projectedTotal = daysPassed > 0 ? ratePerDay * daysTotal : totalExpense;
    const totalAllocated = [...allocByCat.values()].reduce((s, v) => s + v, 0);
    const dailyBudget = daysTotal > 0 ? totalAllocated / daysTotal : 0;

    const projection: SummaryProjectionDto = {
      days_passed: daysPassed,
      days_total: daysTotal,
      days_left: daysLeft,
      rate_per_day: ratePerDay,
      projected_total: projectedTotal,
      daily_budget: dailyBudget,
    };

    return {
      year,
      month: month0,
      totals,
      by_category: byCategory,
      daily,
      trend,
      projection,
    };
  }
}

function compareYm(a: [number, number], b: [number, number]): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  return a[1] - b[1];
}
