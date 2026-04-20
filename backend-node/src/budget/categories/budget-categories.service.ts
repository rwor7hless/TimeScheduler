import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BudgetCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BudgetCategoryCreateDto,
  BudgetCategoryResponseDto,
  BudgetCategoryUpdateDto,
} from '../dto/budget-category.dto';

const DEFAULT_CATS: Array<{
  key: string;
  label: string;
  icon: string;
  color: string;
  sort_order: number;
}> = [
  { key: 'food', label: 'Еда', icon: '🍔', color: '#F59E0B', sort_order: 0 },
  { key: 'transport', label: 'Транспорт', icon: '🚗', color: '#3B82F6', sort_order: 1 },
  { key: 'housing', label: 'Жильё', icon: '🏠', color: '#8B5CF6', sort_order: 2 },
  { key: 'health', label: 'Здоровье', icon: '💊', color: '#10B981', sort_order: 3 },
  { key: 'entertainment', label: 'Развлечения', icon: '🎮', color: '#F97316', sort_order: 4 },
  { key: 'clothing', label: 'Одежда', icon: '👗', color: '#EC4899', sort_order: 5 },
  { key: 'tech', label: 'Техника', icon: '💻', color: '#06B6D4', sort_order: 6 },
  { key: 'education', label: 'Образование', icon: '📚', color: '#84CC16', sort_order: 7 },
  { key: 'travel', label: 'Путешествия', icon: '✈️', color: '#EF4444', sort_order: 8 },
  { key: 'subscriptions', label: 'Подписки', icon: '🔄', color: '#6366F1', sort_order: 9 },
  { key: 'other', label: 'Прочее', icon: '📦', color: '#9CA3AF', sort_order: 10 },
];

function slugify(label: string): string {
  // Python's re.sub(r'[^\w]+', '-', ..., flags=re.UNICODE) — \w includes
  // unicode word chars, so Cyrillic letters stay. JS regex with `u` flag +
  // `\p{L}` / `\p{N}` is the equivalent.
  let s = label.trim().toLowerCase();
  s = s.replace(/[^\p{L}\p{N}_]+/gu, '-').replace(/^-+|-+$/g, '');
  return (s || 'cat').slice(0, 50);
}

@Injectable()
export class BudgetCategoriesService {
  private readonly logger = new Logger(BudgetCategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private serialize(c: BudgetCategory): BudgetCategoryResponseDto {
    return {
      id: c.id,
      key: c.key,
      label: c.label,
      icon: c.icon,
      color: c.color,
      sort_order: c.sort_order,
      is_archived: c.is_archived,
    };
  }

  async ensureDefaults(userId: number): Promise<void> {
    const count = await this.prisma.budgetCategory.count({ where: { user_id: userId } });
    if (count > 0) return;
    try {
      await this.prisma.budgetCategory.createMany({
        data: DEFAULT_CATS.map((d) => ({
          user_id: userId,
          key: d.key,
          label: d.label,
          icon: d.icon,
          color: d.color,
          sort_order: d.sort_order,
          is_archived: false,
          created_at: new Date(),
        })),
        skipDuplicates: true,
      });
    } catch (err) {
      // Concurrent callers may race: catch P2002 unique violations and move
      // on — the second caller just reads what the first inserted.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.debug(`defaults race: swallowed P2002 for user_id=${userId}`);
        return;
      }
      throw err;
    }
  }

  async list(userId: number, includeArchived: boolean): Promise<BudgetCategoryResponseDto[]> {
    await this.ensureDefaults(userId);
    const rows = await this.prisma.budgetCategory.findMany({
      where: { user_id: userId, ...(includeArchived ? {} : { is_archived: false }) },
      orderBy: [{ sort_order: 'asc' }, { label: 'asc' }],
    });
    return rows.map((r) => this.serialize(r));
  }

  async create(userId: number, data: BudgetCategoryCreateDto): Promise<BudgetCategoryResponseDto> {
    const key = data.key ?? slugify(data.label);
    const existing = await this.prisma.budgetCategory.findFirst({
      where: { user_id: userId, key },
    });
    if (existing) {
      throw new BadRequestException('Category with this key already exists');
    }
    let sortOrder = data.sort_order;
    if (sortOrder === undefined || sortOrder === null) {
      const max = await this.prisma.budgetCategory.aggregate({
        where: { user_id: userId },
        _max: { sort_order: true },
      });
      sortOrder = (max._max.sort_order ?? 0) + 1;
    }
    const cat = await this.prisma.budgetCategory.create({
      data: {
        user_id: userId,
        key,
        label: data.label,
        icon: data.icon ?? '📦',
        color: data.color ?? '#9CA3AF',
        sort_order: sortOrder,
        is_archived: false,
        created_at: new Date(),
      },
    });
    return this.serialize(cat);
  }

  async update(
    userId: number,
    id: number,
    data: BudgetCategoryUpdateDto,
  ): Promise<BudgetCategoryResponseDto> {
    const existing = await this.prisma.budgetCategory.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) throw new NotFoundException('Category not found');
    const updated = await this.prisma.budgetCategory.update({
      where: { id },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.sort_order !== undefined ? { sort_order: data.sort_order } : {}),
        ...(data.is_archived !== undefined ? { is_archived: data.is_archived } : {}),
      },
    });
    return this.serialize(updated);
  }

  async delete(userId: number, id: number): Promise<void> {
    const existing = await this.prisma.budgetCategory.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) throw new NotFoundException('Category not found');
    await this.prisma.budgetCategory.delete({ where: { id } });
  }
}

// Exported for tests.
export { DEFAULT_CATS, slugify };
