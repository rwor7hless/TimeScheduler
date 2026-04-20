import { Injectable } from '@nestjs/common';
import { Habit, KanbanStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PRIORITY_FROM_PRISMA } from '../tasks/dto/task-create.dto';
import { BreakdownItemDto } from './dto/breakdown-item.dto';
import { DailyCompletionDto } from './dto/daily-completion.dto';
import { HabitProgressDto } from './dto/habit-progress.dto';
import { PreviousPeriodMetricsDto } from './dto/previous-period-metrics.dto';
import { StatsResponseDto } from './dto/stats-response.dto';

/** Russian labels + chart colors for priority breakdown. Copied verbatim
 *  from `backend/app/services/stats.py`. */
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  urgent: 'Срочный',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: '#9CA3AF',
  medium: '#3B82F6',
  high: '#F59E0B',
  urgent: '#EF4444',
};

interface Window {
  start: Date; // inclusive
  end: Date; // exclusive
  days: number; // whole-day span
}

/** Format a Date as YYYY-MM-DD using UTC. */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Construct a UTC midnight Date from a YYYY-MM-DD string. */
function utcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function windowForWeek(weekStartYmd: string): Window {
  const start = utcMidnight(weekStartYmd);
  const end = new Date(start.getTime() + 7 * 86400_000);
  return { start, end, days: 7 };
}

function windowForPeriod(periodDays: number): Window {
  const now = new Date();
  const start = new Date(now.getTime() - periodDays * 86400_000);
  return { start, end: now, days: periodDays };
}

/**
 * Ports `backend/app/services/stats.py`. Two modes:
 *   1. `period_days` (trailing window ending now) — used by Month/Year.
 *   2. `week_start` (fixed Mon..Sun window) — drives the Stats-page Week
 *      tab and triggers previous-period metrics for delta badges.
 *
 * All window math is UTC, matching Python's `datetime.now(timezone.utc)`.
 * We keep the same SQL surface (filter on `completed_at`/`created_at`
 * windows, GROUP-BY priority/board/tag) via Prisma groupBy + findMany.
 */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(
    userId: number,
    opts: { periodDays?: number; weekStart?: string | null },
  ): Promise<StatsResponseDto> {
    const periodDays = opts.periodDays ?? 30;
    const weekStart = opts.weekStart ?? null;
    const win = weekStart ? windowForWeek(weekStart) : windowForPeriod(periodDays);

    const taskFilter: Prisma.TaskWhereInput = {
      user_id: userId,
      deleted_at: null,
    };

    // Active tasks (not done, not archived) — running total, not window-scoped.
    const activeTasks = await this.prisma.task.count({
      where: { ...taskFilter, status: { not: KanbanStatus.DONE }, is_archived: false },
    });

    // Completed in window
    const completedLastMonth = await this.prisma.task.count({
      where: {
        ...taskFilter,
        status: KanbanStatus.DONE,
        completed_at: { gte: win.start, lt: win.end },
      },
    });

    // Overdue — snapshot against "now", not window end.
    const now = new Date();
    const overdueCount = await this.prisma.task.count({
      where: {
        ...taskFilter,
        status: { not: KanbanStatus.DONE },
        is_archived: false,
        deadline: { lt: now, not: null },
      },
    });

    // Avg completion hours — use raw SQL for EXTRACT(EPOCH).
    const avgRow = await this.prisma.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM completed_at) - EXTRACT(EPOCH FROM created_at)) AS avg
      FROM tasks
      WHERE user_id = ${userId}
        AND deleted_at IS NULL
        AND completed_at IS NOT NULL
        AND completed_at >= ${win.start}
        AND completed_at < ${win.end}
    `;
    const avgSeconds = avgRow[0]?.avg ?? null;
    const avgCompletionHours = avgSeconds != null ? round1(Number(avgSeconds) / 3600) : null;

    // Productivity = completed_in_window / created_in_window
    const totalCreated = await this.prisma.task.count({
      where: {
        ...taskFilter,
        created_at: { gte: win.start, lt: win.end },
      },
    });
    const productivityPercent =
      totalCreated > 0 ? round1((completedLastMonth / totalCreated) * 100) : null;

    // Most active hours — take the 4 most common completion hours.
    const completedRows = await this.prisma.task.findMany({
      where: {
        ...taskFilter,
        completed_at: { gte: win.start, lt: win.end, not: null },
      },
      select: { completed_at: true },
    });
    const hourCounts = new Map<number, number>();
    for (const r of completedRows) {
      if (!r.completed_at) continue;
      const h = r.completed_at.getUTCHours();
      hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
    }
    // Python's `Counter.most_common(4)`: sort desc by count; ties preserve
    // insertion order. Array.prototype.sort in Node is stable (V8), so
    // seeding entries in hour-iteration order gives Python-parity ties.
    const mostActiveHours = Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([h]) => h);

    // Daily completions (GROUP BY DATE(completed_at)).
    const dailyRows = await this.prisma.$queryRaw<{ day: Date; cnt: bigint }[]>`
      SELECT DATE(completed_at) AS day, COUNT(id)::bigint AS cnt
      FROM tasks
      WHERE user_id = ${userId}
        AND deleted_at IS NULL
        AND completed_at IS NOT NULL
        AND completed_at >= ${win.start}
        AND completed_at < ${win.end}
      GROUP BY DATE(completed_at)
      ORDER BY DATE(completed_at)
    `;
    const dailyCompletions: DailyCompletionDto[] = dailyRows.map((r) => ({
      date: r.day instanceof Date ? toIsoDate(r.day) : String(r.day).slice(0, 10),
      count: Number(r.cnt),
    }));

    // By priority (window-scoped, only completed).
    const priorityGroup = await this.prisma.task.groupBy({
      by: ['priority'],
      where: {
        ...taskFilter,
        completed_at: { gte: win.start, lt: win.end, not: null },
      },
      _count: { id: true },
    });
    const byPriority: BreakdownItemDto[] = priorityGroup.map((row) => {
      const wire = PRIORITY_FROM_PRISMA[row.priority];
      return {
        label: PRIORITY_LABELS[wire] ?? wire,
        count: row._count.id,
        color: PRIORITY_COLORS[wire] ?? null,
      };
    });

    // By board — use raw SQL for LEFT JOIN + "Основная" fallback when null.
    const boardRows = await this.prisma.$queryRaw<{ name: string | null; cnt: bigint }[]>`
      SELECT b.name AS name, COUNT(t.id)::bigint AS cnt
      FROM tasks t
      LEFT JOIN boards b ON t.board_id = b.id
      WHERE t.user_id = ${userId}
        AND t.deleted_at IS NULL
        AND t.completed_at IS NOT NULL
        AND t.completed_at >= ${win.start}
        AND t.completed_at < ${win.end}
      GROUP BY b.name
    `;
    const byBoard: BreakdownItemDto[] = boardRows.map((r) => ({
      label: r.name ?? 'Основная',
      count: Number(r.cnt),
      color: null,
    }));

    // By tag — inner join through task_tags.
    const tagRows = await this.prisma.$queryRaw<{ name: string; color: string; cnt: bigint }[]>`
      SELECT tg.name AS name, tg.color AS color, COUNT(t.id)::bigint AS cnt
      FROM tasks t
      JOIN task_tags tt ON tt.task_id = t.id
      JOIN tags tg ON tg.id = tt.tag_id
      WHERE t.user_id = ${userId}
        AND t.deleted_at IS NULL
        AND t.completed_at IS NOT NULL
        AND t.completed_at >= ${win.start}
        AND t.completed_at < ${win.end}
      GROUP BY tg.name, tg.color
    `;
    const byTag: BreakdownItemDto[] = tagRows.map((r) => ({
      label: r.name,
      count: Number(r.cnt),
      color: r.color,
    }));

    // Habits — per-window flags + rate + streak (from today).
    const habits: Habit[] = await this.prisma.habit.findMany({
      where: { user_id: userId, is_active: true },
    });
    const windowStartYmd = toIsoDate(win.start);
    const windowEndYmd = toIsoDate(win.end);
    const todayDate = new Date();
    const todayYmd = toIsoDate(
      new Date(
        Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), todayDate.getUTCDate()),
      ),
    );

    const habitProgress: HabitProgressDto[] = [];
    for (const habit of habits) {
      const windowLogs = await this.prisma.habitLog.findMany({
        where: {
          habit_id: habit.id,
          date: { gte: utcMidnight(windowStartYmd), lt: utcMidnight(windowEndYmd) },
        },
        select: { date: true },
      });
      const windowSet = new Set(windowLogs.map((r) => toIsoDate(r.date)));
      const logCount = windowSet.size;
      const completionRate = win.days ? round2(logCount / win.days) : 0;

      const daysFlags: boolean[] = [];
      for (let i = 0; i < win.days; i++) {
        const dayMs = utcMidnight(windowStartYmd).getTime() + i * 86400_000;
        daysFlags.push(windowSet.has(toIsoDate(new Date(dayMs))));
      }

      // Streak looks back from today independently of the window.
      const oneYearAgo = new Date(utcMidnight(todayYmd).getTime() - 365 * 86400_000);
      const streakLogs = await this.prisma.habitLog.findMany({
        where: {
          habit_id: habit.id,
          date: { gte: oneYearAgo, lte: utcMidnight(todayYmd) },
        },
        select: { date: true },
      });
      const streakSet = new Set(streakLogs.map((r) => toIsoDate(r.date)));
      let streak = 0;
      let checkMs = utcMidnight(todayYmd).getTime();
      while (streakSet.has(toIsoDate(new Date(checkMs)))) {
        streak += 1;
        checkMs -= 86400_000;
      }

      habitProgress.push({
        habit_id: habit.id,
        name: habit.name,
        completion_rate: completionRate,
        current_streak: streak,
        days: daysFlags,
      });
    }

    // Previous-week metrics — only in week mode.
    let previousPeriodMetrics: PreviousPeriodMetricsDto | null = null;
    if (weekStart) {
      const prevStartMs = utcMidnight(weekStart).getTime() - 7 * 86400_000;
      const prevStartYmd = toIsoDate(new Date(prevStartMs));
      previousPeriodMetrics = await this.computePrevMetrics(userId, prevStartYmd);
    }

    return {
      active_tasks: activeTasks,
      completed_last_month: completedLastMonth,
      overdue_count: overdueCount,
      avg_completion_hours: avgCompletionHours,
      productivity_percent: productivityPercent,
      most_active_hours: mostActiveHours,
      habit_progress: habitProgress,
      daily_completions: dailyCompletions,
      by_priority: byPriority,
      by_board: byBoard,
      by_tag: byTag,
      week_start: weekStart ?? null,
      previous_period_metrics: previousPeriodMetrics,
    };
  }

  private async computePrevMetrics(
    userId: number,
    prevWeekStartYmd: string,
  ): Promise<PreviousPeriodMetricsDto> {
    const win = windowForWeek(prevWeekStartYmd);
    const taskFilter: Prisma.TaskWhereInput = {
      user_id: userId,
      deleted_at: null,
    };

    const completed = await this.prisma.task.count({
      where: {
        ...taskFilter,
        status: KanbanStatus.DONE,
        completed_at: { gte: win.start, lt: win.end },
      },
    });

    const created = await this.prisma.task.count({
      where: {
        ...taskFilter,
        created_at: { gte: win.start, lt: win.end },
      },
    });

    const productivity = created > 0 ? round1((completed / created) * 100) : null;

    const activeDaysRow = await this.prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(DISTINCT DATE(completed_at))::bigint AS cnt
      FROM tasks
      WHERE user_id = ${userId}
        AND deleted_at IS NULL
        AND completed_at >= ${win.start}
        AND completed_at < ${win.end}
    `;
    const activeDays = Number(activeDaysRow[0]?.cnt ?? 0);

    const habits = await this.prisma.habit.findMany({
      where: { user_id: userId, is_active: true },
    });
    let habitsDonePct: number | null = null;
    if (habits.length > 0) {
      let totalPct = 0;
      for (const habit of habits) {
        const logCount = await this.prisma.habitLog.count({
          where: {
            habit_id: habit.id,
            date: { gte: win.start, lt: win.end },
          },
        });
        totalPct += logCount / 7;
      }
      habitsDonePct = round1((totalPct / habits.length) * 100);
    }

    return {
      completed_count: completed,
      productivity_percent: productivity,
      active_days: activeDays,
      habits_done_pct: habitsDonePct,
    };
  }
}

/** Python's `round(x, 1)` uses banker's rounding on ties, but the values we
 *  round here (ratios * 100, epoch/3600) effectively never land on .x5 edges
 *  in practice. Math.round half-to-even differences would be cosmetic. */
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
