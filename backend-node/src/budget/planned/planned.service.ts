import { Injectable, NotFoundException } from '@nestjs/common';
import { BudgetTag, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PlannedConvertRequestDto,
  PlannedPurchaseCreateDto,
  PlannedPurchaseResponseDto,
  PlannedPurchaseUpdateDto,
} from '../dto/planned.dto';
import { TransactionResponseDto } from '../dto/transaction.dto';
import { todayIsoDate } from '../budget.utils';
import { resolveTagIds, serializeTransaction } from '../transactions/transactions.service';

type PlannedWithTags = Prisma.PlannedPurchaseGetPayload<{
  include: { planned_tags: { include: { budget_tags: true } } };
}>;

function serializePlanned(p: PlannedWithTags): PlannedPurchaseResponseDto {
  const tags = p.planned_tags
    .map((pt: { budget_tags: BudgetTag }) => pt.budget_tags)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((bt: BudgetTag) => ({ id: bt.id, name: bt.name, color: bt.color }));
  return {
    id: p.id,
    year: p.year,
    month: p.month,
    amount: p.amount,
    category: p.category,
    description: p.description,
    done: p.done,
    created_at: p.created_at.toISOString(),
    tags,
    source_recurring_id: p.source_recurring_id,
  };
}

@Injectable()
export class PlannedService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: number,
    year: number | undefined,
    month: number | undefined,
  ): Promise<PlannedPurchaseResponseDto[]> {
    const where: Prisma.PlannedPurchaseWhereInput = { user_id: userId };
    if (year !== undefined) where.year = year;
    if (month !== undefined) where.month = month;

    const rows = await this.prisma.plannedPurchase.findMany({
      where,
      orderBy: { created_at: 'asc' },
      include: { planned_tags: { include: { budget_tags: true } } },
    });
    return rows.map((r) => serializePlanned(r));
  }

  async create(
    userId: number,
    data: PlannedPurchaseCreateDto,
  ): Promise<PlannedPurchaseResponseDto> {
    const validTagIds = await resolveTagIds(this.prisma, userId, data.tag_ids);
    const created = await this.prisma.plannedPurchase.create({
      data: {
        user_id: userId,
        year: data.year,
        month: data.month,
        amount: data.amount,
        category: data.category ?? null,
        description: data.description ?? '',
        done: data.done ?? false,
        created_at: new Date(),
        planned_tags: {
          create: validTagIds.map((id) => ({ tag_id: id })),
        },
      },
      include: { planned_tags: { include: { budget_tags: true } } },
    });
    return serializePlanned(created);
  }

  async update(
    userId: number,
    id: number,
    data: PlannedPurchaseUpdateDto,
  ): Promise<PlannedPurchaseResponseDto> {
    const existing = await this.prisma.plannedPurchase.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) throw new NotFoundException('Planned purchase not found');

    const patch: Prisma.PlannedPurchaseUpdateInput = {};
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.category !== undefined) patch.category = data.category;
    if (data.description !== undefined) patch.description = data.description;
    if (data.done !== undefined) patch.done = data.done;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(patch).length > 0) {
        await tx.plannedPurchase.update({ where: { id }, data: patch });
      }
      if (data.tag_ids !== undefined) {
        const validTagIds = await resolveTagIds(tx, userId, data.tag_ids);
        await tx.plannedTag.deleteMany({ where: { planned_purchase_id: id } });
        if (validTagIds.length > 0) {
          await tx.plannedTag.createMany({
            data: validTagIds.map((tid) => ({ planned_purchase_id: id, tag_id: tid })),
            skipDuplicates: true,
          });
        }
      }
      return tx.plannedPurchase.findUniqueOrThrow({
        where: { id },
        include: { planned_tags: { include: { budget_tags: true } } },
      });
    });
    return serializePlanned(updated);
  }

  async delete(userId: number, id: number): Promise<void> {
    const existing = await this.prisma.plannedPurchase.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) throw new NotFoundException('Planned purchase not found');
    await this.prisma.plannedPurchase.delete({ where: { id } });
  }

  async convert(
    userId: number,
    id: number,
    data: PlannedConvertRequestDto,
  ): Promise<TransactionResponseDto> {
    const pp = await this.prisma.plannedPurchase.findFirst({
      where: { id, user_id: userId },
      include: { planned_tags: true },
    });
    if (!pp) throw new NotFoundException('Planned purchase not found');

    const amount = data.amount ?? pp.amount;
    const txDate = data.date ?? todayIsoDate();
    const tagIdsToUse =
      data.tag_ids !== undefined ? data.tag_ids : pp.planned_tags.map((pt) => pt.tag_id);

    const validTagIds = await resolveTagIds(this.prisma, userId, tagIdsToUse);

    const created = await this.prisma.$transaction(async (tx) => {
      const newTx = await tx.transaction.create({
        data: {
          user_id: userId,
          type: 'expense',
          amount,
          category: pp.category,
          description: pp.description,
          date: txDate,
          source_planned_id: pp.id,
          created_at: new Date(),
          transaction_tags: {
            create: validTagIds.map((tid) => ({ tag_id: tid })),
          },
        },
        include: { transaction_tags: { include: { budget_tags: true } } },
      });
      await tx.plannedPurchase.delete({ where: { id: pp.id } });
      return newTx;
    });
    return serializeTransaction(created);
  }
}
