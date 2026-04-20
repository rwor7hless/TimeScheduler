import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BoardsService } from './boards.service';
import { BoardCreateDto } from './dto/board-create.dto';
import { BoardResponseDto } from './dto/board-response.dto';
import { BoardUpdateDto } from './dto/board-update.dto';

/**
 * `/api/boards` — ports `backend/app/routers/boards.py`. Class-level
 * `JwtAuthGuard` mirrors Python's `dependencies=[Depends(get_current_user)]`.
 */
@Controller('boards')
@UseGuards(JwtAuthGuard)
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<BoardResponseDto[]> {
    return this.boards.list(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: User, @Body() body: BoardCreateDto): Promise<BoardResponseDto> {
    return this.boards.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: BoardUpdateDto,
  ): Promise<BoardResponseDto> {
    return this.boards.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.boards.delete(user.id, id);
  }
}
