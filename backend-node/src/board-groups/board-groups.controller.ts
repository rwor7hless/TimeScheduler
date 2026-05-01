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
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BoardGroupsService } from './board-groups.service';
import { BoardGroupCreateDto } from './dto/board-group-create.dto';
import { BoardGroupReorderDto } from './dto/board-group-reorder.dto';
import { BoardGroupResponseDto } from './dto/board-group-response.dto';
import { BoardGroupUpdateDto } from './dto/board-group-update.dto';

@Controller('board-groups')
@UseGuards(JwtAuthGuard)
export class BoardGroupsController {
  constructor(private readonly groups: BoardGroupsService) {}

  // `reorder` MUST come before `:id` so Nest's path-router doesn't shadow it.
  @Patch('reorder')
  reorder(
    @CurrentUser() user: User,
    @Body() body: BoardGroupReorderDto,
  ): Promise<{ ok: true }> {
    return this.groups.reorder(user.id, body);
  }

  @Get()
  list(@CurrentUser() user: User): Promise<BoardGroupResponseDto[]> {
    return this.groups.list(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: User,
    @Body() body: BoardGroupCreateDto,
  ): Promise<BoardGroupResponseDto> {
    return this.groups.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: BoardGroupUpdateDto,
  ): Promise<BoardGroupResponseDto> {
    return this.groups.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Query('cascade', new ParseBoolPipe({ optional: true })) cascade?: boolean,
  ): Promise<void> {
    await this.groups.delete(user.id, id, Boolean(cascade));
  }
}
