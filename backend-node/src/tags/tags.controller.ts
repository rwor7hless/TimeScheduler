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
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TagCreateDto } from './dto/tag-create.dto';
import { TagResponseDto } from './dto/tag-response.dto';
import { TagsService } from './tags.service';

/**
 * `/api/tags` — ports `backend/app/routers/tags.py`. Class-level JWT guard
 * mirrors Python's router-level dependency.
 */
@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<TagResponseDto[]> {
    return this.tags.list(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: User, @Body() body: TagCreateDto): Promise<TagResponseDto> {
    return this.tags.create(user.id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.tags.delete(user.id, id);
  }
}
