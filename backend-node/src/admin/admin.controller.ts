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
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { UserCreateDto } from './dto/user-create.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserUpdateDto } from './dto/user-update.dto';

/**
 * `/api/admin/users` CRUD. Matches `backend/app/routers/admin.py`.
 *
 * The class-level guards enforce auth + admin-only — same as Python's
 * `dependencies=[Depends(get_admin_user)]` at the router level.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  list(): Promise<UserResponseDto[]> {
    return this.adminService.list();
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: UserCreateDto): Promise<UserResponseDto> {
    return this.adminService.create(body);
  }

  @Patch('users/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UserUpdateDto,
  ): Promise<UserResponseDto> {
    return this.adminService.update(id, body);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: User,
  ): Promise<void> {
    await this.adminService.delete(id, currentUser);
  }
}
