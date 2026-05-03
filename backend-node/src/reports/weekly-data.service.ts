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
 * collects tasks without a board. Бюджетный блок берётся из
 * `BudgetWeeklyService.buildWeeklyBlock` (DI через `@Optional()`); если
 * сервис не зарегистрирован — fallback на нули в `stubWeeklyBudget`.
 *
 * Все недельные границы рассчитываются по МСК (UTC+3, без DST). См.
 * комментарий рядом с `TZ_OFFSET_HOURS` ниже.
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

// Москва — фиксированный UTC+3 без DST с 2014-го. Все недельные границы
// и форматирование дат строятся через эту стенку, чтобы «понедельник 00:00»
// в отчёте совпадал с понедельником 00:00 МСК, а не UTC (старая версия
// съезжала на 3 часа: задача, закрытая в пн 02:30 МСК, попадала в прошлую
// неделю, потому что в UTC это был ещё воскресенье).
const TZ_OFFSET_HOURS = 3;

@Injectable()
export class WeeklyDataService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly budgetWeekly?: BudgetWeeklyService,
  ) {}

  /** Переводит UTC-инстант в «MSK wall-clock as if it were UTC».
   *  Удобно, чтобы потом дёргать getUTC* и читать московские год/месяц/день. */
  private toMsk(d: Date): Date {
    return new Date(d.getTime() + TZ_OFFSET_HOURS * 3600 * 1000);
  }

  /** Обратно: «MSK wall-clock» → реальный UTC-инстант. */
  private fromMsk(d: Date): Date {
    return new Date(d.getTime() - TZ_OFFSET_HOURS * 3600 * 1000);
  }

  private mondayOf(d: Date): Date {
    // Возвращаем «календарную дату МСК-понедельника» как Date с UTC-полями,
    // равными MSK-году/месяцу/дню. См. ReportsService.mondayOf — та же
    // семантика. Реальные временные границы (UTC Sun 21:00 ↔ Sun 20:59:59)
    // считаются ниже из этого Date вычитанием TZ-офсета.
    const msk = this.toMsk(d);
    const jsDay = msk.getUTCDay();
    const weekdayPy = (jsDay + 6) % 7;
    return new Date(
      Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() - weekdayPy),
    );
  }

  mondayOfToday(): Date {
    return this.mondayOf(new Date());
  }

  /** Формат «DD.MM.YYYY» по UTC-полям. Используется для weekStart/weekEnd,
   *  у которых UTC-поля заранее выставлены равными календарной дате МСК. */
  private fmtCalendarDate(d: Date): string {
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getUTCFullYear());
    return `${dd}.${mm}.${yyyy}`;
  }

  /** Формат «DD.MM.YYYY» в МСК. Для реальных Timestamptz-значений (дедлайны):
   *  без сдвига дедлайн «13 апр 00:00 МСК» (= UTC 12 апр 21:00) выглядел как
   *  «12.04». */
  private fmtTimestampMsk(d: Date): string {
    return this.fmtCalendarDate(this.toMsk(d));
  }

  private fmtTaskEntry(task: TaskRow): TaskEntryInput {
    const priority = PRIORITY_RU[task.priority] ?? 'средний';
    const deadline = task.deadline ? this.fmtTimestampMsk(task.deadline) : null;
    return { title: task.title, priority, deadline };
  }

  private sortByPriority(tasks: TaskRow[]): TaskRow[] {
    return [...tasks].sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99),
    );
  }

  async buildWeeklyData(userId: number, weekStart: Date): Promise<WeeklyDataInput> {
    // weekStart хранит календарную дату МСК-понедельника в UTC-полях
    // (UTC Mon 00:00). Реальный момент MSK Mon 00:00 в UTC — это minus 3h
    // (UTC Sun 21:00). Из этого момента строим окно для запросов по Timestamptz.
    const TZ_OFFSET_MS = TZ_OFFSET_HOURS * 3600 * 1000;
    const ws = new Date(weekStart.getTime() - TZ_OFFSET_MS);
    const we = new Date(ws.getTime() + 7 * 24 * 3600 * 1000 - 1000);
    // weekEnd для подписи и budgetWeekly — календарная дата воскресенья МСК,
    // в той же логике (UTC-поля = MSK Y/M/D).
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 3600 * 1000);

    const projects = await this.collectProjectStats(userId, ws, we);
    const habits = await this.collectHabitStats(userId, ws, we);
    const budget = this.budgetWeekly
      ? await this.budgetWeekly.buildWeeklyBlock(userId, weekEnd)
      : this.stubWeeklyBudget();

    return {
      week_start: this.fmtCalendarDate(weekStart),
      week_end: this.fmtCalendarDate(weekEnd),
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

      // Просрочка ограничена окном текущей недели — иначе каждый отчёт
      // тянет за собой одни и те же «древние» хвосты с прошлогодними
      // дедлайнами, и список «провалов» оказывается одинаковым из недели
      // в неделю. Берём только те задачи, дедлайн которых ВПАДАЕТ В ЭТУ
      // НЕДЕЛЮ и которые не закрыты — это и есть собственные провалы недели.
      const overdueRows = (await this.prisma.task.findMany({
        where: {
          ...base,
          done: false,
          deadline: { gte: ws, lte: we },
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
    if (habits.length === 0) return [];

    // Границы по МСК-«дате» (HabitLog.date — это @db.Date без времени).
    // Берём день/месяц/год от московского wall-clock-а, чтобы не съезжать на
    // сутки в районе полуночи UTC.
    const wsMsk = this.toMsk(ws);
    const weMsk = this.toMsk(we);
    const weekStartDate = new Date(
      Date.UTC(wsMsk.getUTCFullYear(), wsMsk.getUTCMonth(), wsMsk.getUTCDate()),
    );
    const weekEndDate = new Date(
      Date.UTC(weMsk.getUTCFullYear(), weMsk.getUTCMonth(), weMsk.getUTCDate()),
    );

    // Один groupBy вместо N запросов. _count.habit_id даёт число логов
    // на привычку в окне недели.
    const grouped = await this.prisma.habitLog.groupBy({
      by: ['habit_id'],
      where: {
        habit_id: { in: habits.map((h) => h.id) },
        date: { gte: weekStartDate, lte: weekEndDate },
      },
      _count: { habit_id: true },
    });
    const doneByHabit = new Map<number, number>();
    for (const row of grouped) {
      doneByHabit.set(row.habit_id, row._count.habit_id);
    }

    const result: HabitStatsInput[] = habits.map((h) => ({
      name: h.name,
      done_days: doneByHabit.get(h.id) ?? 0,
    }));

    // Провалы (наименьший процент) первыми. Поскольку знаменатель у всех 7 —
    // сортировка по done_days эквивалентна сортировке по проценту, но
    // выражаем намерение явно через habitPct.
    result.sort(
      (a, b) =>
        Math.round((a.done_days / 7) * 100) - Math.round((b.done_days / 7) * 100),
    );
    return result;
  }

  // Fallback на случай, если BudgetWeeklyService не зарегистрирован в DI
  // (ловится через `@Optional()` в конструкторе). В проде BudgetModule
  // импортирован в ReportsModule, и сюда не попадаем — стаб остаётся
  // только для unit-тестов, которые подменяют PrismaService руками.
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
