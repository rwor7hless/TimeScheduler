import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  TransactionCreateDto,
  TransactionResponseDto,
  TransactionUpdateDto,
} from '../dto/transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('budget/transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly txs: TransactionsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('year') yearRaw?: string,
    @Query('month') monthRaw?: string,
  ): Promise<TransactionResponseDto[]> {
    // Ручной парсинг: @Query + ParseIntPipe({optional:true}) криво работает
    // в этой версии Nest — пустой query даёт "Validation failed". Здесь
    // undefined остаётся undefined, строка парсится в int.
    const year = yearRaw !== undefined && yearRaw !== '' ? Number(yearRaw) : undefined;
    const month = monthRaw !== undefined && monthRaw !== '' ? Number(monthRaw) : undefined;
    return this.txs.list(user.id, year, month);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: User,
    @Body() body: TransactionCreateDto,
  ): Promise<TransactionResponseDto> {
    return this.txs.create(user.id, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: TransactionUpdateDto,
  ): Promise<TransactionResponseDto> {
    return this.txs.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.txs.delete(user.id, id);
  }
}
