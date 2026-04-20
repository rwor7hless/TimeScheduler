import { Injectable, NotFoundException } from '@nestjs/common';
import { Board } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BoardCreateDto } from './dto/board-create.dto';
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
      created_at: b.created_at.toISOString(),
      updated_at: b.updated_at.toISOString(),
    };
  }

  async list(userId: number): Promise<BoardResponseDto[]> {
    const boards = await this.prisma.board.findMany({
      where: { user_id: userId },
      orderBy: { id: 'asc' },
    });
    return boards.map((b) => this.serialize(b));
  }

  async create(userId: number, data: BoardCreateDto): Promise<BoardResponseDto> {
    const now = new Date();
    const board = await this.prisma.board.create({
      data: {
        user_id: userId,
        name: data.name,
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
    const updated = await this.prisma.board.update({
      where: { id },
      data: { name: data.name, updated_at: new Date() },
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
}
