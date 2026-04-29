import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReorderDto } from './dto/reorder.dto';
import { PRIORITY_VALUES, PriorityWire, TaskCreateDto } from './dto/task-create.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { TaskUpdateDto } from './dto/task-update.dto';
import { TasksService } from './tasks.service';

/**
 * `/api/tasks` — ports `backend/app/routers/tasks.py`.
 *
 * NestJS route matching is ORDER-DEPENDENT. Static routes like
 * `/archived` and `/reorder` MUST be declared before `/:id`, otherwise
 * `GET /api/tasks/archived` hits the `:id` handler with `id="archived"`
 * and ParseIntPipe rejects it with 400. Controllers declare these first.
 */
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('archived')
  listArchived(@CurrentUser() user: User): Promise<TaskResponseDto[]> {
    return this.tasks.listArchived(user.id);
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  reorder(@CurrentUser() user: User, @Body() body: ReorderDto): Promise<{ ok: true }> {
    return this.tasks.reorder(user.id, body);
  }

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('done') doneRaw?: string,
    @Query('priority') priority?: string,
    @Query('tag') tag?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('search') search?: string,
    @Query('board_id') boardIdRaw?: string,
    @Query('default_board', new DefaultValuePipe(false), ParseBoolPipe) defaultBoard?: boolean,
    @Query('scope') scope?: string,
    @Query('include_subtasks', new DefaultValuePipe(false), ParseBoolPipe)
    includeSubtasks?: boolean,
  ): Promise<TaskResponseDto[]> {
    const priorityFilter = (PRIORITY_VALUES as readonly string[]).includes(priority ?? '')
      ? (priority as PriorityWire)
      : undefined;
    const boardId = boardIdRaw ? Number.parseInt(boardIdRaw, 10) : undefined;
    let done: boolean | undefined;
    if (doneRaw === 'true') done = true;
    else if (doneRaw === 'false') done = false;

    return this.tasks.list(user.id, {
      done,
      priority: priorityFilter,
      tag: tag || undefined,
      date_from: dateFrom,
      date_to: dateTo,
      search: search || undefined,
      board_id: Number.isFinite(boardId) ? boardId : undefined,
      default_board: defaultBoard,
      scope: scope || undefined,
      include_subtasks: includeSubtasks,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: User, @Body() body: TaskCreateDto): Promise<TaskResponseDto> {
    return this.tasks.create(user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number): Promise<TaskResponseDto> {
    return this.tasks.get(user.id, id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: TaskCreateDto,
  ): Promise<TaskResponseDto> {
    return this.tasks.update(user.id, id, body);
  }

  @Patch(':id')
  patch(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: TaskUpdateDto,
  ): Promise<TaskResponseDto> {
    return this.tasks.patch(user.id, id, body);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.tasks.archive(user.id, id);
  }

  @Post(':id/unarchive')
  unarchive(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TaskResponseDto> {
    return this.tasks.unarchive(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Query('permanent', new DefaultValuePipe(false), ParseBoolPipe) permanent: boolean,
  ): Promise<void> {
    await this.tasks.delete(user.id, id, permanent);
  }
}
