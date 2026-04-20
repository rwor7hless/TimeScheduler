import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Tag } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TagCreateDto } from './dto/tag-create.dto';
import { TagResponseDto } from './dto/tag-response.dto';

const DEFAULT_COLOR = '#6B7280';

/**
 * Ports `backend/app/routers/tags.py`. List is ordered by `Tag.name` (line
 * 19 of Python router). Duplicate create → 400 "Tag with this name already
 * exists" (line 34). Python does the check with a pre-SELECT; we pair that
 * with a P2002 catch for the TOCTOU race (same pattern as AdminService).
 */
@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(t: Tag): TagResponseDto {
    return { id: t.id, name: t.name, color: t.color };
  }

  async list(userId: number): Promise<TagResponseDto[]> {
    const tags = await this.prisma.tag.findMany({
      where: { user_id: userId },
      orderBy: { name: 'asc' },
    });
    return tags.map((t) => this.serialize(t));
  }

  async create(userId: number, data: TagCreateDto): Promise<TagResponseDto> {
    const existing = await this.prisma.tag.findFirst({
      where: { user_id: userId, name: data.name },
    });
    if (existing) {
      throw new BadRequestException('Tag with this name already exists');
    }
    try {
      const tag = await this.prisma.tag.create({
        data: {
          user_id: userId,
          name: data.name,
          color: data.color ?? DEFAULT_COLOR,
        },
      });
      return this.serialize(tag);
    } catch (err) {
      // Race-window insurance: two concurrent POSTs can both pass the
      // findFirst above and collide on the `@@unique([user_id, name])`
      // index. Translate P2002 to the same 400 the pre-check surfaces.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Tag with this name already exists');
      }
      throw err;
    }
  }

  async delete(userId: number, id: number): Promise<void> {
    const existing = await this.prisma.tag.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) {
      throw new NotFoundException('Tag not found');
    }
    // `task_tags` rows drop via the TaskTag relation's `onDelete: Cascade`
    // (see schema.prisma), matching the Python FK's `ondelete="CASCADE"`.
    await this.prisma.tag.delete({ where: { id } });
  }
}
