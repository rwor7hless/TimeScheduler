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
  PlannedConvertRequestDto,
  PlannedPurchaseCreateDto,
  PlannedPurchaseResponseDto,
  PlannedPurchaseUpdateDto,
} from '../dto/planned.dto';
import { TransactionResponseDto } from '../dto/transaction.dto';
import { PlannedService } from './planned.service';

@Controller('budget/planned')
@UseGuards(JwtAuthGuard)
export class PlannedController {
  constructor(private readonly planned: PlannedService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
    @Query('month', new ParseIntPipe({ optional: true })) month?: number,
  ): Promise<PlannedPurchaseResponseDto[]> {
    return this.planned.list(user.id, year, month);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: User,
    @Body() body: PlannedPurchaseCreateDto,
  ): Promise<PlannedPurchaseResponseDto> {
    return this.planned.create(user.id, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PlannedPurchaseUpdateDto,
  ): Promise<PlannedPurchaseResponseDto> {
    return this.planned.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.planned.delete(user.id, id);
  }

  @Post(':id/convert')
  @HttpCode(HttpStatus.CREATED)
  convert(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PlannedConvertRequestDto,
  ): Promise<TransactionResponseDto> {
    return this.planned.convert(user.id, id, body);
  }
}
