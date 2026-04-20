import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminBootstrapService } from './admin-bootstrap.service';

describe('AdminBootstrapService', () => {
  let service: AdminBootstrapService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let authService: { hashPassword: jest.Mock; verifyPassword: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    authService = { hashPassword: jest.fn(), verifyPassword: jest.fn() };
    config = {
      get: jest.fn((k: string) => {
        if (k === 'USER_LOGIN') return 'admin';
        if (k === 'USER_PASSWORD') return 'initial-pw';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminBootstrapService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<AdminBootstrapService>(AdminBootstrapService);
  });

  it('creates the admin when it does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    authService.hashPassword.mockResolvedValue('new-hash');

    await service.onApplicationBootstrap();

    expect(authService.hashPassword).toHaveBeenCalledWith('initial-pw');
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { username: 'admin', password_hash: 'new-hash', is_admin: true },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('updates password_hash when the env password changed', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, password_hash: 'old-hash' });
    authService.verifyPassword.mockResolvedValue(false);
    authService.hashPassword.mockResolvedValue('new-hash');

    await service.onApplicationBootstrap();

    expect(authService.verifyPassword).toHaveBeenCalledWith('initial-pw', 'old-hash');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { password_hash: 'new-hash', is_admin: true },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('no-ops when password is unchanged', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, password_hash: 'old-hash' });
    authService.verifyPassword.mockResolvedValue(true);

    await service.onApplicationBootstrap();

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(authService.hashPassword).not.toHaveBeenCalled();
  });

  it('skips gracefully when USER_LOGIN is missing', async () => {
    config.get.mockImplementation((k: string) => (k === 'USER_PASSWORD' ? 'x' : undefined));
    await service.onApplicationBootstrap();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
