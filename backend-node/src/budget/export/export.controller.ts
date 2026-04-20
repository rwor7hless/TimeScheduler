import { Controller, Get, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { monthRange0, pad2, pad4 } from '../budget.utils';
import { TRANSACTION_TYPES, TransactionTypeWire } from '../dto/transaction.dto';

/**
 * Python's `csv.writer(..., quoting=csv.QUOTE_MINIMAL)` quotes a field iff
 * it contains a comma, double-quote, CR, or LF. Double-quotes inside the
 * field are escaped by doubling them. We replicate that here.
 */
export function csvEscape(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function toCsvRow(cells: string[]): string {
  return cells.map(csvEscape).join(',');
}

@Controller('budget/export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async download(
    @CurrentUser() user: User,
    @Res() res: Response,
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
    @Query('month', new ParseIntPipe({ optional: true })) month?: number,
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
    @Query('type') type?: string,
  ): Promise<void> {
    const where: Prisma.TransactionWhereInput = { user_id: user.id };
    if (year !== undefined && month !== undefined) {
      const { start, end } = monthRange0(year, month);
      where.date = { gte: start, lte: end };
    }
    if (fromDate !== undefined) {
      where.date = { ...(where.date as object), gte: fromDate };
    }
    if (toDate !== undefined) {
      where.date = { ...(where.date as object), lte: toDate };
    }
    if (type !== undefined && TRANSACTION_TYPES.includes(type as TransactionTypeWire)) {
      where.type = type;
    }

    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      include: { transaction_tags: { include: { budget_tags: true } } },
    });

    const lines: string[] = [];
    lines.push(toCsvRow(['date', 'type', 'amount', 'category', 'description', 'tags']));
    for (const t of rows) {
      const tagNames = t.transaction_tags
        .map((tt) => tt.budget_tags.name)
        .sort()
        .join(',');
      lines.push(
        toCsvRow([
          t.date,
          t.type,
          t.amount.toFixed(2),
          t.category ?? '',
          t.description ?? '',
          tagNames,
        ]),
      );
    }
    const body = lines.join('\r\n') + '\r\n';

    const fname =
      year !== undefined && month !== undefined
        ? `budget-${pad4(year)}-${pad2(month + 1)}.csv`
        : 'budget-all.csv';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(body);
  }
}
