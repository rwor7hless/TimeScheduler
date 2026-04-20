import { Injectable, NotFoundException } from '@nestjs/common';
import { BudgetTag } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BudgetTagCreateDto,
  BudgetTagResponseDto,
  BudgetTagUpdateDto,
} from '../dto/budget-tag.dto';

@Injectable()
export class BudgetTagsService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(t: BudgetTag): BudgetTagResponseDto {
    return { id: t.id, name: t.name, color: t.color };
  }

  async list(userId: number): Promise<BudgetTagResponseDto[]> {
    const rows = await this.prisma.budgetTag.findMany({
      where: { user_id: userId },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.serialize(r));
  }

  async create(userId: number, data: BudgetTagCreateDto): Promise<BudgetTagResponseDto> {
    const tag = await this.prisma.budgetTag.create({
      data: {
        user_id: userId,
        name: data.name,
        color: data.color ?? '#6B7280',
      },
    });
    return this.serialize(tag);
  }

  async update(
    userId: number,
    id: number,
    data: BudgetTagUpdateDto,
  ): Promise<BudgetTagResponseDto> {
    const existing = await this.prisma.budgetTag.findFirst({ where: { id, user_id: userId } });
    if (!existing) throw new NotFoundException('Tag not found');
    const updated = await this.prisma.budgetTag.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
      },
    });
    return this.serialize(updated);
  }

  async delete(userId: number, id: number): Promise<void> {
    const existing = await this.prisma.budgetTag.findFirst({ where: { id, user_id: userId } });
    if (!existing) throw new NotFoundException('Tag not found');
    await this.prisma.budgetTag.delete({ where: { id } });
  }
}
