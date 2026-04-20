import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserCreateDto } from './dto/user-create.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserUpdateDto } from './dto/user-update.dto';

/**
 * Admin user CRUD. Ports `backend/app/routers/admin.py`:
 *
 * - `list` — ordered by `created_at` ascending (Python does the same).
 * - `create` — 400 on duplicate username, same status + text as Python.
 * - `update` — only `can_request_summary` is editable.
 * - `delete` — 400 if deleting self; 400 if deleting the last admin.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  private serialize(user: User): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      is_admin: user.is_admin,
      can_request_summary: user.can_request_summary,
      created_at: user.created_at.toISOString(),
    };
  }

  async list(): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({ orderBy: { created_at: 'asc' } });
    return users.map((u) => this.serialize(u));
  }

  async create(data: UserCreateDto): Promise<UserResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { username: data.username } });
    if (existing) {
      // Python returns 400 with "Username already exists" (see
      // `backend/app/routers/admin.py`). We preserve both exactly even though
      // the task spec suggested 409 — Python wins per the review contract.
      throw new BadRequestException('Username already exists');
    }
    const password_hash = await this.authService.hashPassword(data.password);
    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        password_hash,
        is_admin: false,
      },
    });
    return this.serialize(user);
  }

  async update(userId: number, data: UserUpdateDto): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const updates: { can_request_summary?: boolean } = {};
    if (typeof data.can_request_summary === 'boolean') {
      updates.can_request_summary = data.can_request_summary;
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updates,
    });
    return this.serialize(updated);
  }

  async delete(userId: number, currentUser: User): Promise<void> {
    if (currentUser.id === userId) {
      // Python uses 400 + "Cannot delete your own account".
      throw new BadRequestException('Cannot delete your own account');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.is_admin) {
      const adminCount = await this.prisma.user.count({ where: { is_admin: true } });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot delete the last admin');
      }
    }
    await this.prisma.user.delete({ where: { id: userId } });
    // Returning void — controller handles 204 No Content via @HttpCode.
  }
}
