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
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RecurringCreateDto, RecurringResponseDto, RecurringUpdateDto } from '../dto/recurring.dto';
import { RecurringService } from './recurring.service';

@Controller('budget/recurring')
@UseGuards(JwtAuthGuard)
export class RecurringController {
  constructor(private readonly recurring: RecurringService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<RecurringResponseDto[]> {
    return this.recurring.list(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: User,
    @Body() body: RecurringCreateDto,
  ): Promise<RecurringResponseDto> {
    return this.recurring.create(user.id, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RecurringUpdateDto,
  ): Promise<RecurringResponseDto> {
    return this.recurring.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.recurring.delete(user.id, id);
  }
}
