import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
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
  BudgetCategoryCreateDto,
  BudgetCategoryResponseDto,
  BudgetCategoryUpdateDto,
} from '../dto/budget-category.dto';
import { BudgetCategoriesService } from './budget-categories.service';

@Controller('budget/categories')
@UseGuards(JwtAuthGuard)
export class BudgetCategoriesController {
  constructor(private readonly cats: BudgetCategoriesService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('include_archived', new ParseBoolPipe({ optional: true }))
    includeArchived?: boolean,
  ): Promise<BudgetCategoryResponseDto[]> {
    return this.cats.list(user.id, Boolean(includeArchived));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: User,
    @Body() body: BudgetCategoryCreateDto,
  ): Promise<BudgetCategoryResponseDto> {
    return this.cats.create(user.id, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: BudgetCategoryUpdateDto,
  ): Promise<BudgetCategoryResponseDto> {
    return this.cats.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.cats.delete(user.id, id);
  }
}
