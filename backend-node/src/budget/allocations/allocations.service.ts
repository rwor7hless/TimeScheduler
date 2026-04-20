import { Injectable, NotFoundException } from '@nestjs/common';
import { BudgetAllocation } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AllocationResponseDto, AllocationUpsertDto } from '../dto/allocation.dto';

@Injectable()
export class AllocationsService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(a: BudgetAllocation): AllocationResponseDto {
    return {
      id: a.id,
      year: a.year,
      month: a.month,
      category: a.category,
      limit_amount: a.limit_amount,
      created_at: a.created_at.toISOString(),
    };
  }

  async list(userId: number, year: number, month: number): Promise<AllocationResponseDto[]> {
    const rows = await this.prisma.budgetAllocation.findMany({
      where: { user_id: userId, year, month },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => this.serialize(r));
  }

  async upsert(userId: number, data: AllocationUpsertDto): Promise<AllocationResponseDto> {
    const upserted = await this.prisma.budgetAllocation.upsert({
      where: {
        user_id_year_month_category: {
          user_id: userId,
          year: data.year,
          month: data.month,
          category: data.category,
        },
      },
      update: { limit_amount: data.limit_amount },
      create: {
        user_id: userId,
        year: data.year,
        month: data.month,
        category: data.category,
        limit_amount: data.limit_amount,
        created_at: new Date(),
      },
    });
    return this.serialize(upserted);
  }

  async delete(userId: number, id: number): Promise<void> {
    const existing = await this.prisma.budgetAllocation.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) throw new NotFoundException('Allocation not found');
    await this.prisma.budgetAllocation.delete({ where: { id } });
  }
}
