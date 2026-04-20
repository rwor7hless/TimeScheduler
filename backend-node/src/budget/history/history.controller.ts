import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseArrayPipe,
  ParseFloatPipe,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TransactionResponseDto,
  TRANSACTION_TYPES,
  TransactionTypeWire,
} from '../dto/transaction.dto';
import { serializeTransaction } from '../transactions/transactions.service';

interface HistoryResponse {
  items: TransactionResponseDto[];
  total: number;
  offset: number;
  limit: number;
}

const SORT_COLS = ['date', 'amount'] as const;
const ORDERS = ['asc', 'desc'] as const;

@Controller('budget/history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() user: User,
    @Query('q') q: string | undefined,
    @Query('type') type: string | undefined,
    @Query('tag_ids', new ParseArrayPipe({ items: Number, separator: ',', optional: true }))
    tagIds: number[] | undefined,
    @Query('category') category: string | undefined,
    // `from` is a JS reserved word — alias via @Query.
    @Query('from') fromDate: string | undefined,
    @Query('to') toDate: string | undefined,
    @Query('amount_min', new ParseFloatPipe({ optional: true })) amountMin: number | undefined,
    @Query('amount_max', new ParseFloatPipe({ optional: true })) amountMax: number | undefined,
    @Query('sort', new DefaultValuePipe('date')) sort: string,
    @Query('order', new DefaultValuePipe('desc')) order: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<HistoryResponse> {
    if (type !== undefined && !TRANSACTION_TYPES.includes(type as TransactionTypeWire)) {
      type = undefined;
    }
    if (!SORT_COLS.includes(sort as (typeof SORT_COLS)[number])) sort = 'date';
    if (!ORDERS.includes(order as (typeof ORDERS)[number])) order = 'desc';
    limit = Math.max(1, Math.min(500, limit));
    offset = Math.max(0, offset);

    const where: Prisma.TransactionWhereInput = { user_id: user.id };
    if (type !== undefined) where.type = type;
    if (category !== undefined) where.category = category;
    const dateRange: Prisma.StringFilter = {};
    if (fromDate !== undefined) dateRange.gte = fromDate;
    if (toDate !== undefined) dateRange.lte = toDate;
    if (Object.keys(dateRange).length > 0) where.date = dateRange;
    const amountRange: Prisma.FloatFilter = {};
    if (amountMin !== undefined) amountRange.gte = amountMin;
    if (amountMax !== undefined) amountRange.lte = amountMax;
    if (Object.keys(amountRange).length > 0) where.amount = amountRange;
    if (q) where.description = { contains: q, mode: 'insensitive' };
    if (tagIds && tagIds.length > 0) {
      where.transaction_tags = { some: { tag_id: { in: tagIds } } };
    }

    const sortCol = sort === 'amount' ? 'amount' : 'date';
    const orderDir = order === 'asc' ? 'asc' : 'desc';

    const [total, items] = await this.prisma.$transaction([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        orderBy: [{ [sortCol]: orderDir }, { created_at: 'desc' }],
        take: limit,
        skip: offset,
        include: { transaction_tags: { include: { budget_tags: true } } },
      }),
    ]);

    return {
      items: items.map((t) => serializeTransaction(t)),
      total,
      offset,
      limit,
    };
  }
}
