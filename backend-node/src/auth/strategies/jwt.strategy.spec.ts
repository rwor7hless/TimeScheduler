import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn() } };

    const config = {
      getOrThrow: jest.fn((k: string) => (k === 'SECRET_KEY' ? 'test-secret' : undefined)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('looks up user by id when payload.user_id is present', async () => {
    const user = { id: 42, username: 'alice', is_admin: false };
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await strategy.validate({ sub: 'alice', user_id: 42, exp: 9e9 });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 42 } });
    expect(result).toBe(user);
  });

  it('falls back to username lookup when user_id is missing (legacy tokens)', async () => {
    const user = { id: 7, username: 'legacy', is_admin: true };
    prisma.user.findUnique.mockResolvedValue(user);

    const result = await strategy.validate({ sub: 'legacy', exp: 9e9 });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { username: 'legacy' } });
    expect(result).toBe(user);
  });

  it('throws UnauthorizedException when user is not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'ghost', user_id: 999, exp: 9e9 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
