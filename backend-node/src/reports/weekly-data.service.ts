import { Injectable, Optional } from '@nestjs/common';
import { BudgetWeeklyService } from '../budget/weekly/budget-weekly.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_BUCKET,
  HabitStatsInput,
  ProjectStatsInput,
  TaskEntryInput,
  WeeklyBudgetInput,
  WeeklyDataInput,
} from '../llm/prompts/weekly-report.prompt';

/**
 * Ports `backend/app/services/weekly_report.py` `build_weekly_data`.
 *
 * One kanban board = one project; an extra virtual "Без проекта" bucket
 * collects tasks without a board. Budget block is stubbed for Phase 7 —
 * Phase 8 will replace with real data from BudgetWeeklyService.
 */

const PRIORITY_RU: Record<string, string> = {
  LOW: 'низкий',
  MEDIUM: 'средний',
  HIGH: 'высокий',
  URGENT: 'срочный',
};

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

type TaskRow = {
  id: number;
  title: string;
  priority: string;
  deadline: Date | null;
};

@Injectable()
export class WeeklyDataService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly budgetWeekly?: BudgetWeeklyService,
  ) {}

  private mondayOf(d: Date): Date {
    // In UTC: JS getUTCDay — Sunday=0, Monday=1, ..., Saturday=6.
    // Python weekday(): Monday=0, Sunday=6.
    const jsDay = d.getUTCDay();
    const weekdayPy = (jsDay + 6) % 7;
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - weekdayPy));
    return m;
  }

  mondayOfToday(): Date {
    return this.mondayOf(new Date());
  }

  private fmtDate(d: Date): string {
    // "DD.MM.YYYY"
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getUTCFullYear());
    return `${dd}.${mm}.${yyyy}`;
  }

  private fmtTaskEntry(task: TaskRow): TaskEntryInput {
    const priority = PRIORITY_RU[task.priority] ?? 'средний';
    const deadline = task.deadline ? this.fmtDate(task.deadline) : null;
    return { title: task.title, priority, deadline };
  }

  private sortByPriority(tasks: TaskRow[]): TaskRow[] {
    return [...tasks].sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99),
    );
  }

  async buildWeeklyData(userId: number, weekStart: Date): Promise<WeeklyDataInput> {
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

    const ws = new Date(
      Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate()),
    );
    const we = new Date(
      Date.UTC(weekEnd.getUTCFullYear(), weekEnd.getUTCMonth(), weekEnd.getUTCDate(), 23, 59, 59),
    );

    const projects = await this.collectProjectStats(userId, ws, we);
    const habits = await this.collectHabitStats(userId, ws, we);
    const budget = this.budgetWeekly
      ? await this.budgetWeekly.buildWeeklyBlock(userId, weekEnd)
      : this.stubWeeklyBudget();

    return {
      week_start: this.fmtDate(weekStart),
      week_end: this.fmtDate(weekEnd),
      projects,
      habits,
      budget,
    };
  }

  private async collectProjectStats(
    userId: number,
    ws: Date,
    we: Date,
  ): Promise<ProjectStatsInput[]> {
    const boards = await this.prisma.board.findMany({
      where: { user_id: userId },
      orderBy: { name: 'asc' },
    });

    const slots: Array<{ boardId: number | null; name: string }> = [
      ...boards.map((b) => ({ boardId: b.id, name: b.name })),
      { boardId: null, name: DEFAULT_BUCKET },
    ];

    const projects: ProjectStatsInput[] = [];
    for (const slot of slots) {
      const base = {
        user_id: userId,
        deleted_at: null,
        is_archived: false,
        ...(slot.boardId === null ? { board_id: null } : { board_id: slot.boardId }),
      };

      const doneRows = (await this.prisma.task.findMany({
        where: {
          ...base,
          done: true,
          completed_at: { gte: ws, lte: we },
        },
        select: { id: true, title: true, priority: true, deadline: true },
      })) as TaskRow[];

      const overdueRows = (await this.prisma.task.findMany({
        where: {
          ...base,
          done: false,
          deadline: { lt: we, not: null },
        },
        select: { id: true, title: true, priority: true, deadline: true },
      })) as TaskRow[];

      // Open (not done, not overdue) — replaces the old IN_PROGRESS+TODO split
      // since `done` is now binary.
      const todoCount = await this.prisma.task.count({
        where: {
          ...base,
          done: false,
          OR: [{ deadline: null }, { deadline: { gte: we } }],
        },
      });

      if (doneRows.length === 0 && overdueRows.length === 0 && todoCount === 0) {
        continue;
      }

      projects.push({
        name: slot.name,
        done_tasks: this.sortByPriority(doneRows).map((t) => this.fmtTaskEntry(t)),
        overdue_tasks: this.sortByPriority(overdueRows).map((t) => this.fmtTaskEntry(t)),
        todo_count: todoCount,
      });
    }

    return projects;
  }

  private async collectHabitStats(userId: number, ws: Date, we: Date): Promise<HabitStatsInput[]> {
    const habits = await this.prisma.habit.findMany({
      where: { user_id: userId, is_active: true },
    });
    const weekStartDate = new Date(
      Date.UTC(ws.getUTCFullYear(), ws.getUTCMonth(), ws.getUTCDate()),
    );
    const weekEndDate = new Date(Date.UTC(we.getUTCFullYear(), we.getUTCMonth(), we.getUTCDate()));

    const result: HabitStatsInput[] = [];
    for (const habit of habits) {
      const doneDays = await this.prisma.habitLog.count({
        where: {
          habit_id: habit.id,
          date: { gte: weekStartDate, lte: weekEndDate },
        },
      });
      result.push({ name: habit.name, done_days: doneDays });
    }
    // Sort failures first (lowest pct first) — mirrors Python `key=lambda h: h.pct`.
    result.sort((a, b) => a.done_days - b.done_days);
    return result;
  }

  // TODO(phase-8): replace with BudgetWeeklyService.buildBlock(userId, weekEnd).
  private stubWeeklyBudget(): WeeklyBudgetInput {
    return {
      total_expense: 0,
      total_income: 0,
      top_categories: [],
      avg_per_week: 0,
      delta_pct: null,
      planned_done: 0,
      planned_total: 0,
      overspent: [],
    };
  }
}
