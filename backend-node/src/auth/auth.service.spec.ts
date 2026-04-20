import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock } };
  let jwtService: { signAsync: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn() } };
    jwtService = { signAsync: jest.fn() };
    configService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('hashPassword / verifyPassword', () => {
    it('hashes a password and verifies it round-trip', async () => {
      const hash = await service.hashPassword('hunter2');
      expect(hash).toMatch(/^\$argon2id\$/);
      expect(await service.verifyPassword('hunter2', hash)).toBe(true);
    });

    it('rejects wrong passwords', async () => {
      const hash = await service.hashPassword('hunter2');
      expect(await service.verifyPassword('wrong', hash)).toBe(false);
    });

    it('returns false for a malformed hash instead of throwing', async () => {
      expect(await service.verifyPassword('anything', 'not-a-real-hash')).toBe(false);
    });

    it('verifies a fixed argon2id hash produced with pwdlib params', async () => {
      // This hash uses argon2id with m=65536, t=3, p=4 — the exact parameters that
      // pwdlib.PasswordHash.recommended() emits in Python. The `argon2` npm package
      // reads all tunables from the PHC-encoded string, so this static fixture
      // doubles as a regression guard on hash-format compatibility. The real
      // end-to-end proof (verifying the admin user's DB-stored hash) lives in
      // test/argon2-portability.e2e-spec.ts.
      const fixedHash =
        '$argon2id$v=19$m=65536,t=3,p=4$aTi/dsYGi+vFNoTUqU4CPw$DtlXWnvRgW7SiHIYNeWjG+DSPhbk2v2qMIrtFLbu6ew';
      expect(await service.verifyPassword('hunter2', fixedHash)).toBe(true);
      expect(await service.verifyPassword('wrong', fixedHash)).toBe(false);
    });
  });

  describe('createAccessToken', () => {
    it('signs a JWT with {sub, user_id, exp} payload and default 30-day expiry', async () => {
      configService.get.mockReturnValue(undefined); // no env → default 43200
      jwtService.signAsync.mockResolvedValue('signed-token');

      const before = Math.floor(Date.now() / 1000);
      const token = await service.createAccessToken(42, 'alice');
      const after = Math.floor(Date.now() / 1000);

      expect(token).toBe('signed-token');
      expect(jwtService.signAsync).toHaveBeenCalledTimes(1);
      const payload = jwtService.signAsync.mock.calls[0][0];
      expect(payload.sub).toBe('alice');
      expect(payload.user_id).toBe(42);
      // Default 30d = 43200 min = 2592000 sec. Allow 2s jitter for test timing.
      expect(payload.exp).toBeGreaterThanOrEqual(before + 2592000);
      expect(payload.exp).toBeLessThanOrEqual(after + 2592000);
    });

    it('honors JWT_EXPIRE_MINUTES when set', async () => {
      configService.get.mockImplementation((k: string) =>
        k === 'JWT_EXPIRE_MINUTES' ? '60' : undefined,
      );
      jwtService.signAsync.mockResolvedValue('t');

      const before = Math.floor(Date.now() / 1000);
      await service.createAccessToken(1, 'x');
      const payload = jwtService.signAsync.mock.calls[0][0];

      expect(payload.exp).toBeGreaterThanOrEqual(before + 3600);
      expect(payload.exp).toBeLessThanOrEqual(before + 3601);
    });
  });

  describe('validateUser', () => {
    it('returns null when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      expect(await service.validateUser('missing', 'pw')).toBeNull();
    });

    it('returns null when password is wrong', async () => {
      const hash = await service.hashPassword('correct');
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'u',
        password_hash: hash,
      });
      expect(await service.validateUser('u', 'wrong')).toBeNull();
    });

    it('returns the user when credentials match', async () => {
      const hash = await service.hashPassword('correct');
      const userRow = { id: 1, username: 'u', password_hash: hash };
      prisma.user.findUnique.mockResolvedValue(userRow);
      const result = await service.validateUser('u', 'correct');
      expect(result).toBe(userRow);
    });
  });
});
