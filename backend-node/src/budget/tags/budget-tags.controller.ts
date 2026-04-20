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
import {
  BudgetTagCreateDto,
  BudgetTagResponseDto,
  BudgetTagUpdateDto,
} from '../dto/budget-tag.dto';
import { BudgetTagsService } from './budget-tags.service';

@Controller('budget/tags')
@UseGuards(JwtAuthGuard)
export class BudgetTagsController {
  constructor(private readonly tags: BudgetTagsService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<BudgetTagResponseDto[]> {
    return this.tags.list(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: User,
    @Body() body: BudgetTagCreateDto,
  ): Promise<BudgetTagResponseDto> {
    return this.tags.create(user.id, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: BudgetTagUpdateDto,
  ): Promise<BudgetTagResponseDto> {
    return this.tags.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.tags.delete(user.id, id);
  }
}
