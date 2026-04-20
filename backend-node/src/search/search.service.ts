import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KANBAN_FROM_PRISMA, PRIORITY_FROM_PRISMA } from '../tasks/dto/task-create.dto';

export interface SearchTaskItem {
  id: number;
  title: string;
  status: string;
  priority: string;
  color: string | null;
  board_id: number | null;
  tags: { id: number; name: string; color: string }[];
  type: 'task';
}
export interface SearchHabitItem {
  id: number;
  name: string;
  color: string;
  is_active: boolean;
  type: 'habit';
}
export interface SearchBoardItem {
  id: number;
  name: string;
  type: 'board';
}
export interface SearchResult {
  tasks: SearchTaskItem[];
  habits: SearchHabitItem[];
  boards: SearchBoardItem[];
}

/**
 * Ports `backend/app/routers/search.py`. Ilike across tasks/habits/boards,
 * user-scoped. Every item carries a `type` discriminator so the frontend
 * can render a single flat suggestion list with per-type icons.
 *
 * Tasks are limited to 20, habits/boards to 10 — matches Python.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: number, q: string): Promise<SearchResult> {
    // Escape LIKE wildcards so a query like `50% off` doesn't match anything
    // containing any 3 characters after "50". Prisma's `contains` with mode
    // `insensitive` emits `ILIKE '%' || $1 || '%'` without further escaping
    // the param, so `%` and `_` inside the user string would act as wildcards.
    // Pre-escape to neutralize them.
    const escaped = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

    const taskRows = await this.prisma.task.findMany({
      where: {
        user_id: userId,
        is_archived: false,
        parent_id: null,
        deleted_at: null,
        title: { contains: escaped, mode: 'insensitive' },
      },
      orderBy: { updated_at: 'desc' },
      take: 20,
      include: { task_tags: { include: { tags: true } } },
    });
    const tasks: SearchTaskItem[] = taskRows.map((t) => ({
      id: t.id,
      title: t.title,
      status: KANBAN_FROM_PRISMA[t.status],
      priority: PRIORITY_FROM_PRISMA[t.priority],
      color: t.color ?? null,
      board_id: t.board_id,
      tags: t.task_tags.map((tt) => ({
        id: tt.tags.id,
        name: tt.tags.name,
        color: tt.tags.color,
      })),
      type: 'task',
    }));

    const habitRows = await this.prisma.habit.findMany({
      where: {
        user_id: userId,
        name: { contains: escaped, mode: 'insensitive' },
      },
      take: 10,
    });
    const habits: SearchHabitItem[] = habitRows.map((h) => ({
      id: h.id,
      name: h.name,
      color: h.color,
      is_active: h.is_active,
      type: 'habit',
    }));

    const boardRows = await this.prisma.board.findMany({
      where: {
        user_id: userId,
        name: { contains: escaped, mode: 'insensitive' },
      },
      take: 10,
    });
    const boards: SearchBoardItem[] = boardRows.map((b) => ({
      id: b.id,
      name: b.name,
      type: 'board',
    }));

    return { tasks, habits, boards };
  }
}
