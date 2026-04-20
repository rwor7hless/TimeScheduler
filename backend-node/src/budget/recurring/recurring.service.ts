import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RecurringTransaction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecurringCreateDto, RecurringResponseDto, RecurringUpdateDto } from '../dto/recurring.dto';

function serialize(r: RecurringTransaction): RecurringResponseDto {
  return {
    id: r.id,
    type: r.type,
    amount: r.amount,
    category: r.category,
    description: r.description,
    tag_ids: r.tag_ids,
    day_of_month: r.day_of_month,
    start_date: r.start_date,
    end_date: r.end_date,
    last_generated_date: r.last_generated_date,
    is_paused: r.is_paused,
    created_at: r.created_at.toISOString(),
  };
}

@Injectable()
export class RecurringService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number): Promise<RecurringResponseDto[]> {
    const rows = await this.prisma.recurringTransaction.findMany({
      where: { user_id: userId },
      orderBy: [{ day_of_month: 'asc' }, { id: 'asc' }],
    });
    return rows.map(serialize);
  }

  async create(userId: number, data: RecurringCreateDto): Promise<RecurringResponseDto> {
    if (data.day_of_month < 1 || data.day_of_month > 31) {
      throw new BadRequestException('day_of_month must be 1..31');
    }
    const created = await this.prisma.recurringTransaction.create({
      data: {
        user_id: userId,
        type: data.type,
        amount: data.amount,
        category: data.category ?? null,
        description: data.description ?? '',
        tag_ids: data.tag_ids ?? [],
        day_of_month: data.day_of_month,
        start_date: data.start_date,
        end_date: data.end_date ?? null,
        is_paused: data.is_paused ?? false,
        created_at: new Date(),
      },
    });
    return serialize(created);
  }

  async update(
    userId: number,
    id: number,
    data: RecurringUpdateDto,
  ): Promise<RecurringResponseDto> {
    const existing = await this.prisma.recurringTransaction.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) throw new NotFoundException('Recurring template not found');
    if (data.day_of_month !== undefined && (data.day_of_month < 1 || data.day_of_month > 31)) {
      throw new BadRequestException('day_of_month must be 1..31');
    }

    const patch: Prisma.RecurringTransactionUpdateInput = {};
    if (data.type !== undefined) patch.type = data.type;
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.category !== undefined) patch.category = data.category;
    if (data.description !== undefined) patch.description = data.description;
    if (data.tag_ids !== undefined) patch.tag_ids = data.tag_ids;
    if (data.day_of_month !== undefined) patch.day_of_month = data.day_of_month;
    if (data.start_date !== undefined) patch.start_date = data.start_date;
    if (data.end_date !== undefined) patch.end_date = data.end_date;
    if (data.is_paused !== undefined) patch.is_paused = data.is_paused;

    const updated = await this.prisma.recurringTransaction.update({
      where: { id },
      data: patch,
    });
    return serialize(updated);
  }

  async delete(userId: number, id: number): Promise<void> {
    const existing = await this.prisma.recurringTransaction.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) throw new NotFoundException('Recurring template not found');
    await this.prisma.recurringTransaction.delete({ where: { id } });
  }
}

export { serialize as serializeRecurring };
