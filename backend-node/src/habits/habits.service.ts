import { Injectable, NotFoundException } from '@nestjs/common';
import { Habit, HabitLog, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HabitCreateDto } from './dto/habit-create.dto';
import { HabitLogResponseDto } from './dto/habit-log-response.dto';
import { HabitLogToggleDto } from './dto/habit-log-toggle.dto';
import { HabitResponseDto } from './dto/habit-response.dto';
import { HabitUpdateDto } from './dto/habit-update.dto';

const DEFAULT_COLOR = '#10B981';

type HabitWithLogs = Habit & { habit_logs: HabitLog[] };

/**
 * Ports `backend/app/routers/habits.py`. Ordering: list by `created_at` asc
 * (line 33). Eager-loads logs (selectinload in Python, `include: {habit_logs}`
 * here). Update uses `exclude_unset=True` semantics — only fields explicitly
 * sent by the caller are written.
 *
 * Log toggle: try insert → if P2002 on `uq_habit_date`, delete the existing
 * row and return null. Matches the optimistic upsert-or-delete flow at
 * habits.py lines 111-129. Python uses `IntegrityError`; Prisma raises
 * `P2002`.
 */
@Injectable()
export class HabitsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `date` column is `@db.Date` — Prisma returns a JS Date at UTC midnight.
   * We slice the ISO string to the YYYY-MM-DD prefix to match Pydantic's
   * `date` serialization (no time component, no timezone offset).
   */
  private serializeDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private serializeLog(log: HabitLog): HabitLogResponseDto {
    return {
      id: log.id,
      habit_id: log.habit_id,
      date: this.serializeDate(log.date),
      completed_at: log.completed_at.toISOString(),
    };
  }

  private serializeHabit(h: HabitWithLogs): HabitResponseDto {
    return {
      id: h.id,
      name: h.name,
      description: h.description,
      color: h.color,
      is_active: h.is_active,
      created_at: h.created_at.toISOString(),
      logs: h.habit_logs.map((l) => this.serializeLog(l)),
    };
  }

  async list(userId: number): Promise<HabitResponseDto[]> {
    const habits = await this.prisma.habit.findMany({
      where: { user_id: userId },
      include: { habit_logs: true },
      orderBy: { created_at: 'asc' },
    });
    return habits.map((h) => this.serializeHabit(h));
  }

  async create(userId: number, data: HabitCreateDto): Promise<HabitResponseDto> {
    const habit = await this.prisma.habit.create({
      data: {
        user_id: userId,
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? DEFAULT_COLOR,
        // Python's `Habit.is_active` defaults to True at the ORM level;
        // the DB column has no server_default, so we set it explicitly.
        is_active: true,
        created_at: new Date(),
      },
      include: { habit_logs: true },
    });
    return this.serializeHabit(habit);
  }

  async update(userId: number, id: number, data: HabitUpdateDto): Promise<HabitResponseDto> {
    const existing = await this.prisma.habit.findFirst({ where: { id, user_id: userId } });
    if (!existing) {
      throw new NotFoundException('Habit not found');
    }
    const updates: Prisma.HabitUpdateInput = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.color !== undefined) updates.color = data.color;
    if (data.is_active !== undefined) updates.is_active = data.is_active;

    // No-op PUT (empty body) — skip the SQL UPDATE, return the habit as
    // already loaded (with its logs). Mirrors the defensive pattern in
    // AdminService.update.
    const habit =
      Object.keys(updates).length === 0
        ? await this.prisma.habit.findUniqueOrThrow({
            where: { id },
            include: { habit_logs: true },
          })
        : await this.prisma.habit.update({
            where: { id },
            data: updates,
            include: { habit_logs: true },
          });
    return this.serializeHabit(habit);
  }

  async delete(userId: number, id: number): Promise<void> {
    const existing = await this.prisma.habit.findFirst({ where: { id, user_id: userId } });
    if (!existing) {
      throw new NotFoundException('Habit not found');
    }
    // HabitLog rows cascade via `onDelete: Cascade` on the FK (see
    // schema.prisma and the Python model's `cascade="all, delete-orphan"`).
    await this.prisma.habit.delete({ where: { id } });
  }

  async toggleLog(
    userId: number,
    habitId: number,
    data: HabitLogToggleDto,
  ): Promise<HabitLogResponseDto | null> {
    const habit = await this.prisma.habit.findFirst({
      where: { id: habitId, user_id: userId },
    });
    if (!habit) {
      throw new NotFoundException('Habit not found');
    }

    // `@db.Date` stores at UTC midnight. `new Date("2026-04-20")` parses
    // as midnight UTC, which is what we want — the same instant the Python
    // `date` object ends up as when SQLAlchemy writes it.
    const dateObj = new Date(`${data.date.slice(0, 10)}T00:00:00.000Z`);

    try {
      const log = await this.prisma.habitLog.create({
        data: {
          habit_id: habitId,
          date: dateObj,
          completed_at: new Date(),
        },
      });
      return this.serializeLog(log);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Toggle off — the unique `(habit_id, date)` pair already exists.
        // Python runs a targeted SELECT + delete; we use deleteMany to
        // avoid a round-trip and to be idempotent if a second racer beats
        // us to the delete.
        await this.prisma.habitLog.deleteMany({
          where: { habit_id: habitId, date: dateObj },
        });
        return null;
      }
      throw err;
    }
  }

  async getLogs(
    userId: number,
    habitId: number,
    fromDate?: string,
    toDate?: string,
  ): Promise<HabitLogResponseDto[]> {
    // Python's route joins Habit on user_id — we replicate with a scoped
    // findFirst so foreign-habit access returns 404 instead of an empty
    // list (matches `Habit.user_id == current_user.id` in habits.py line
    // 143).
    const habit = await this.prisma.habit.findFirst({
      where: { id: habitId, user_id: userId },
    });
    if (!habit) {
      throw new NotFoundException('Habit not found');
    }
    const where: Prisma.HabitLogWhereInput = { habit_id: habitId };
    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(`${fromDate.slice(0, 10)}T00:00:00.000Z`);
      if (toDate) where.date.lte = new Date(`${toDate.slice(0, 10)}T00:00:00.000Z`);
    }
    const logs = await this.prisma.habitLog.findMany({
      where,
      orderBy: { date: 'asc' },
    });
    return logs.map((l) => this.serializeLog(l));
  }
}
