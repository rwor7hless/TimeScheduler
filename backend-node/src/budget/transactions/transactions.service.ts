import { Injectable, NotFoundException } from '@nestjs/common';
import { BudgetTag, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TransactionCreateDto,
  TransactionResponseDto,
  TransactionUpdateDto,
} from '../dto/transaction.dto';
import { monthRange0 } from '../budget.utils';

export type TransactionWithTags = Prisma.TransactionGetPayload<{
  include: { transaction_tags: { include: { budget_tags: true } } };
}>;

export function serializeTransaction(t: TransactionWithTags): TransactionResponseDto {
  const tags = t.transaction_tags
    .map((tt: { budget_tags: BudgetTag }) => tt.budget_tags)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((bt: BudgetTag) => ({ id: bt.id, name: bt.name, color: bt.color }));
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    category: t.category,
    description: t.description,
    date: t.date,
    created_at: t.created_at.toISOString(),
    tags,
    source_planned_id: t.source_planned_id,
  };
}

async function resolveTagIds(
  prisma: PrismaService | Prisma.TransactionClient,
  userId: number,
  tagIds: number[] | undefined,
): Promise<number[]> {
  if (!tagIds || tagIds.length === 0) return [];
  const rows = await prisma.budgetTag.findMany({
    where: { id: { in: tagIds }, user_id: userId },
    select: { id: true },
  });
  return rows.map((r: { id: number }) => r.id);
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: number,
    year: number | undefined,
    month: number | undefined,
  ): Promise<TransactionResponseDto[]> {
    const where: Prisma.TransactionWhereInput = { user_id: userId };
    if (year !== undefined && month !== undefined) {
      const { start, end } = monthRange0(year, month);
      where.date = { gte: start, lte: end };
    }
    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      include: { transaction_tags: { include: { budget_tags: true } } },
    });
    return rows.map((r) => serializeTransaction(r));
  }

  async create(userId: number, data: TransactionCreateDto): Promise<TransactionResponseDto> {
    const validTagIds = await resolveTagIds(this.prisma, userId, data.tag_ids);
    const created = await this.prisma.transaction.create({
      data: {
        user_id: userId,
        type: data.type,
        amount: data.amount,
        category: data.category ?? null,
        description: data.description ?? '',
        date: data.date,
        created_at: new Date(),
        transaction_tags: {
          create: validTagIds.map((id) => ({ tag_id: id })),
        },
      },
      include: { transaction_tags: { include: { budget_tags: true } } },
    });
    return serializeTransaction(created);
  }

  async update(
    userId: number,
    id: number,
    data: TransactionUpdateDto,
  ): Promise<TransactionResponseDto> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) throw new NotFoundException('Transaction not found');

    const patch: Prisma.TransactionUpdateInput = {};
    if (data.type !== undefined) patch.type = data.type;
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.category !== undefined) patch.category = data.category;
    if (data.description !== undefined) patch.description = data.description;
    if (data.date !== undefined) patch.date = data.date;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(patch).length > 0) {
        await tx.transaction.update({ where: { id }, data: patch });
      }
      if (data.tag_ids !== undefined) {
        const validTagIds = await resolveTagIds(tx, userId, data.tag_ids);
        await tx.transactionTag.deleteMany({ where: { transaction_id: id } });
        if (validTagIds.length > 0) {
          await tx.transactionTag.createMany({
            data: validTagIds.map((tid) => ({ transaction_id: id, tag_id: tid })),
            skipDuplicates: true,
          });
        }
      }
      return tx.transaction.findUniqueOrThrow({
        where: { id },
        include: { transaction_tags: { include: { budget_tags: true } } },
      });
    });
    return serializeTransaction(updated);
  }

  async delete(userId: number, id: number): Promise<void> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) throw new NotFoundException('Transaction not found');
    await this.prisma.transaction.delete({ where: { id } });
  }
}

export { resolveTagIds };
