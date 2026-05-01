import { Injectable, NotFoundException } from '@nestjs/common';
import { Board } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BoardCreateDto } from './dto/board-create.dto';
import { BoardReorderDto } from './dto/board-reorder.dto';
import { BoardResponseDto } from './dto/board-response.dto';
import { BoardUpdateDto } from './dto/board-update.dto';

/**
 * Ports `backend/app/routers/boards.py`. All reads/writes are scoped by
 * `user_id` — cross-user access returns 404 (not 403) to match Python's
 * "findFirst-with-user_id → not found" semantics (see line 47, 68 of
 * the Python router).
 *
 * Ordering mirrors Python: list is ordered by `Board.id` (line 20), NOT by
 * `created_at`. Python's `BoardResponse` omits `user_id` even though the
 * model has one — we drop it from the serialized DTO for byte-level parity.
 */
@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(b: Board): BoardResponseDto {
    return {
      id: b.id,
      name: b.name,
      group_id: b.group_id,
      sort_order: b.sort_order,
      created_at: b.created_at.toISOString(),
      updated_at: b.updated_at.toISOString(),
    };
  }

  private async assertGroupOwned(userId: number, groupId: number): Promise<void> {
    const owned = await this.prisma.boardGroup.findFirst({
      where: { id: groupId, user_id: userId },
      select: { id: true },
    });
    if (!owned) {
      throw new NotFoundException('Group not found');
    }
  }

  async list(userId: number): Promise<BoardResponseDto[]> {
    const boards = await this.prisma.board.findMany({
      where: { user_id: userId },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });
    return boards.map((b) => this.serialize(b));
  }

  async create(userId: number, data: BoardCreateDto): Promise<BoardResponseDto> {
    if (data.group_id != null) {
      await this.assertGroupOwned(userId, data.group_id);
    }
    const now = new Date();
    const board = await this.prisma.board.create({
      data: {
        user_id: userId,
        name: data.name,
        group_id: data.group_id ?? null,
        sort_order: data.sort_order ?? 0,
        // The Prisma schema pins `created_at`/`updated_at` to a frozen
        // dbgenerated literal (see schema.prisma comment) so we MUST supply
        // current timestamps explicitly — otherwise every new row would
        // stamp 2026-02-23. Python's SQLAlchemy model has the same
        // server_default but its app-level inserts bypass it too.
        created_at: now,
        updated_at: now,
      },
    });
    return this.serialize(board);
  }

  async update(userId: number, id: number, data: BoardUpdateDto): Promise<BoardResponseDto> {
    const existing = await this.prisma.board.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) {
      throw new NotFoundException('Board not found');
    }

    if (data.group_id != null) {
      await this.assertGroupOwned(userId, data.group_id);
    }

    // Build the patch only from fields that were actually present on the
    // request — `BoardUpdateDto` makes every field optional, so a request
    // that only carries `group_id` must not blow away `name` with `undefined`.
    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.group_id !== undefined) patch.group_id = data.group_id;
    if (data.sort_order !== undefined) patch.sort_order = data.sort_order;

    const updated = await this.prisma.board.update({
      where: { id },
      data: patch,
    });
    return this.serialize(updated);
  }

  async delete(userId: number, id: number): Promise<void> {
    const existing = await this.prisma.board.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) {
      throw new NotFoundException('Board not found');
    }
    // Tasks that referenced this board fall back to `board_id = NULL`
    // because the Prisma relation declares `onDelete: SetNull` (matches the
    // Python model's `ondelete="SET NULL"`). No manual cleanup needed.
    await this.prisma.board.delete({ where: { id } });
  }

  async reorder(userId: number, data: BoardReorderDto): Promise<{ ok: true }> {
    if (!data.ordered_ids || data.ordered_ids.length === 0) {
      return { ok: true };
    }
    const owned = await this.prisma.board.findMany({
      where: {
        id: { in: data.ordered_ids },
        user_id: userId,
        group_id: data.group_id,
      },
      select: { id: true },
    });
    const ownedSet = new Set(owned.map((b) => b.id));
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        data.ordered_ids
          .filter((id) => ownedSet.has(id))
          .map((id, idx) =>
            tx.board.update({
              where: { id },
              data: { sort_order: idx, updated_at: now },
            }),
          ),
      );
    });

    return { ok: true };
  }
}
