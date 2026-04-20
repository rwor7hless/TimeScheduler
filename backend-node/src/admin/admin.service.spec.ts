import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, User } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: 'alice',
    password_hash: 'hash',
    is_admin: false,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    telegram_chat_id: null,
    telegram_key: null,
    can_request_summary: false,
    ...overrides,
  };
}

describe('AdminService', () => {
  let service: AdminService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
  };
  let authService: { hashPassword: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };
    authService = { hashPassword: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('list', () => {
    it('returns users ordered by created_at asc, with ISO-string created_at', async () => {
      prisma.user.findMany.mockResolvedValue([makeUser({ id: 1 }), makeUser({ id: 2 })]);
      const result = await service.list();
      expect(prisma.user.findMany).toHaveBeenCalledWith({ orderBy: { created_at: 'asc' } });
      expect(result).toEqual([
        expect.objectContaining({ id: 1, created_at: '2026-01-01T00:00:00.000Z' }),
        expect.objectContaining({ id: 2 }),
      ]);
    });
  });

  describe('create', () => {
    it('rejects duplicate usernames with 400 "Username already exists"', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      await expect(service.create({ username: 'alice', password: 'x' })).rejects.toMatchObject({
        message: 'Username already exists',
      });
      await expect(service.create({ username: 'alice', password: 'x' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('hashes the password and creates a non-admin user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      authService.hashPassword.mockResolvedValue('hashed!');
      prisma.user.create.mockResolvedValue(makeUser({ username: 'bob' }));

      const result = await service.create({ username: 'bob', password: 'secret' });

      expect(authService.hashPassword).toHaveBeenCalledWith('secret');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { username: 'bob', password_hash: 'hashed!', is_admin: false },
      });
      expect(result.username).toBe('bob');
    });

    it('maps Prisma P2002 on create to 400 "Username already exists"', async () => {
      // Simulate the TOCTOU race: findUnique sees no existing user (so we
      // get past the pre-check), but Prisma.user.create trips the unique
      // index because a concurrent request landed first. The service must
      // translate P2002 into the same 400 the pre-check surfaces.
      prisma.user.findUnique.mockResolvedValue(null);
      authService.hashPassword.mockResolvedValue('hashed!');
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`username`)',
        { code: 'P2002', clientVersion: 'x' },
      );
      prisma.user.create.mockRejectedValue(p2002);

      await expect(service.create({ username: 'bob', password: 'secret' })).rejects.toMatchObject({
        message: 'Username already exists',
      });
      await expect(service.create({ username: 'bob', password: 'secret' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('404s when user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.update(99, { can_request_summary: true })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('flips can_request_summary when provided', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.user.update.mockResolvedValue(makeUser({ can_request_summary: true }));

      const result = await service.update(1, { can_request_summary: true });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { can_request_summary: true },
      });
      expect(result.can_request_summary).toBe(true);
    });

    it('no-ops when body is empty without issuing a SQL UPDATE', async () => {
      // Empty/unchanged body should short-circuit to the already-loaded
      // user — we don't want to spend a pointless round-trip to Postgres.
      const loaded = makeUser();
      prisma.user.findUnique.mockResolvedValue(loaded);

      const result = await service.update(1, {});

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ id: loaded.id, username: loaded.username }));
    });
  });

  describe('delete', () => {
    it('refuses self-delete with 400 "Cannot delete your own account"', async () => {
      const me = makeUser({ id: 1, is_admin: true });
      await expect(service.delete(1, me)).rejects.toMatchObject({
        message: 'Cannot delete your own account',
      });
      await expect(service.delete(1, me)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('404s when target user is missing', async () => {
      const me = makeUser({ id: 1, is_admin: true });
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.delete(99, me)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to delete the last admin', async () => {
      const me = makeUser({ id: 1, is_admin: true });
      prisma.user.findUnique.mockResolvedValue(makeUser({ id: 2, is_admin: true }));
      prisma.user.count.mockResolvedValue(1);
      await expect(service.delete(2, me)).rejects.toMatchObject({
        message: 'Cannot delete the last admin',
      });
    });

    it('deletes a non-last admin cleanly', async () => {
      const me = makeUser({ id: 1, is_admin: true });
      prisma.user.findUnique.mockResolvedValue(makeUser({ id: 2, is_admin: true }));
      prisma.user.count.mockResolvedValue(2);
      prisma.user.delete.mockResolvedValue(undefined);
      await service.delete(2, me);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 2 } });
    });

    it('deletes a non-admin without counting admins', async () => {
      const me = makeUser({ id: 1, is_admin: true });
      prisma.user.findUnique.mockResolvedValue(makeUser({ id: 5, is_admin: false }));
      prisma.user.delete.mockResolvedValue(undefined);
      await service.delete(5, me);
      expect(prisma.user.count).not.toHaveBeenCalled();
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });
  });
});
