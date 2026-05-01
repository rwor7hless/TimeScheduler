import { Injectable, NotFoundException } from '@nestjs/common';
import { BoardGroup } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BoardGroupCreateDto } from './dto/board-group-create.dto';
import { BoardGroupReorderDto } from './dto/board-group-reorder.dto';
import { BoardGroupResponseDto } from './dto/board-group-response.dto';
import { BoardGroupUpdateDto } from './dto/board-group-update.dto';

@Injectable()
export class BoardGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(g: BoardGroup): BoardGroupResponseDto {
    return {
      id: g.id,
      name: g.name,
      sort_order: g.sort_order,
      created_at: g.created_at.toISOString(),
      updated_at: g.updated_at.toISOString(),
    };
  }

  async list(userId: number): Promise<BoardGroupResponseDto[]> {
    const groups = await this.prisma.boardGroup.findMany({
      where: { user_id: userId },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });
    return groups.map((g) => this.serialize(g));
  }

  async create(userId: number, data: BoardGroupCreateDto): Promise<BoardGroupResponseDto> {
    const now = new Date();
    const group = await this.prisma.boardGroup.create({
      data: {
        user_id: userId,
        name: data.name,
        sort_order: 0,
        created_at: now,
        updated_at: now,
      },
    });
    return this.serialize(group);
  }

  async update(
    userId: number,
    id: number,
    data: BoardGroupUpdateDto,
  ): Promise<BoardGroupResponseDto> {
    const existing = await this.prisma.boardGroup.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) {
      throw new NotFoundException('Group not found');
    }
    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (data.name !== undefined) patch.name = data.name;
    const updated = await this.prisma.boardGroup.update({
      where: { id },
      data: patch,
    });
    return this.serialize(updated);
  }

  async delete(userId: number, id: number, cascade: boolean): Promise<void> {
    const existing = await this.prisma.boardGroup.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) {
      throw new NotFoundException('Group not found');
    }
    if (cascade) {
      // Task.board_id is ON DELETE SET NULL, so naively deleting boards orphans
      // their tasks (visible in /tasks as "без списка") — that's NOT what the UI
      // promised ("вместе со списками и их задачами"). Explicitly delete tasks
      // for those boards first inside the same transaction.
      await this.prisma.$transaction(async (tx) => {
        const boardIds = (
          await tx.board.findMany({
            where: { group_id: id },
            select: { id: true },
          })
        ).map((b) => b.id);
        if (boardIds.length > 0) {
          await tx.task.deleteMany({ where: { board_id: { in: boardIds } } });
        }
        await tx.board.deleteMany({ where: { group_id: id } });
        await tx.boardGroup.delete({ where: { id } });
      });
    } else {
      await this.prisma.boardGroup.delete({ where: { id } });
    }
  }

  async reorder(userId: number, data: BoardGroupReorderDto): Promise<{ ok: true }> {
    if (!data.ordered_ids || data.ordered_ids.length === 0) {
      return { ok: true };
    }
    const owned = await this.prisma.boardGroup.findMany({
      where: { id: { in: data.ordered_ids }, user_id: userId },
      select: { id: true },
    });
    const ownedSet = new Set(owned.map((g) => g.id));
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        data.ordered_ids
          .filter((id) => ownedSet.has(id))
          .map((id, idx) =>
            tx.boardGroup.update({
              where: { id },
              data: { sort_order: idx, updated_at: now },
            }),
          ),
      );
    });

    return { ok: true };
  }
}
