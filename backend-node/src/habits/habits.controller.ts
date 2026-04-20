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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HabitCreateDto } from './dto/habit-create.dto';
import { HabitLogResponseDto } from './dto/habit-log-response.dto';
import { HabitLogToggleDto } from './dto/habit-log-toggle.dto';
import { HabitResponseDto } from './dto/habit-response.dto';
import { HabitUpdateDto } from './dto/habit-update.dto';
import { HabitsService } from './habits.service';

/**
 * `/api/habits` — ports `backend/app/routers/habits.py`. Python uses `PUT`
 * for updates (not PATCH), so we follow suit even though PATCH would be
 * more idiomatic. The frontend's `habitsApi.update` also issues PUT.
 */
@Controller('habits')
@UseGuards(JwtAuthGuard)
export class HabitsController {
  constructor(private readonly habits: HabitsService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<HabitResponseDto[]> {
    return this.habits.list(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: User, @Body() body: HabitCreateDto): Promise<HabitResponseDto> {
    return this.habits.create(user.id, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: HabitUpdateDto,
  ): Promise<HabitResponseDto> {
    return this.habits.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.habits.delete(user.id, id);
  }

  @Post(':id/log')
  toggleLog(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: HabitLogToggleDto,
  ): Promise<HabitLogResponseDto | null> {
    return this.habits.toggleLog(user.id, id, body);
  }

  @Get(':id/logs')
  getLogs(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
  ): Promise<HabitLogResponseDto[]> {
    return this.habits.getLogs(user.id, id, fromDate, toDate);
  }
}
