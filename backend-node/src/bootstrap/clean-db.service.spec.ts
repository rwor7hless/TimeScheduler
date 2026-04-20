import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CleanDbService } from './clean-db.service';

describe('CleanDbService', () => {
  let service: CleanDbService;
  let prisma: { $queryRawUnsafe: jest.Mock; $executeRawUnsafe: jest.Mock };
  let config: { get: jest.Mock };

  const build = async (flagValue: string | undefined) => {
    prisma = {
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn(),
    };
    config = {
      get: jest.fn((k: string) => (k === 'CLEAN_DB_ON_STARTUP' ? flagValue : undefined)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanDbService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get<CleanDbService>(CleanDbService);
    // Stub the 3s sleep so tests are fast.
    jest
      .spyOn(service as unknown as { sleep: (ms: number) => Promise<void> }, 'sleep')
      .mockResolvedValue(undefined);
  };

  it('does nothing when the env var is missing', async () => {
    await build(undefined);
    await service.onApplicationBootstrap();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('does nothing when the env var is "false"', async () => {
    await build('false');
    await service.onApplicationBootstrap();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('does nothing when the env var is some arbitrary value', async () => {
    await build('yes');
    await service.onApplicationBootstrap();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('truncates public tables when the env var is "true"', async () => {
    await build('true');
    prisma.$queryRawUnsafe.mockResolvedValue([
      { tablename: 'tasks' },
      { tablename: 'boards' },
      { tablename: 'users' },
    ]);
    prisma.$executeRawUnsafe.mockResolvedValue(0);

    await service.onApplicationBootstrap();

    // Query excludes _prisma_migrations and alembic_version.
    const querySql = prisma.$queryRawUnsafe.mock.calls[0][0] as string;
    expect(querySql).toContain("schemaname = 'public'");
    expect(querySql).toContain("'_prisma_migrations'");
    expect(querySql).toContain("'alembic_version'");

    // TRUNCATE call includes the returned tables with RESTART IDENTITY CASCADE.
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    const truncateSql = prisma.$executeRawUnsafe.mock.calls[0][0] as string;
    expect(truncateSql).toMatch(/^TRUNCATE ONLY /);
    expect(truncateSql).toContain('"tasks"');
    expect(truncateSql).toContain('"boards"');
    expect(truncateSql).toContain('"users"');
    expect(truncateSql).toContain('RESTART IDENTITY CASCADE');
    // Excluded tables must never appear in the TRUNCATE list.
    expect(truncateSql).not.toContain('_prisma_migrations');
    expect(truncateSql).not.toContain('alembic_version');
  });

  it('is case-insensitive: "TRUE" also triggers truncation', async () => {
    await build('TRUE');
    prisma.$queryRawUnsafe.mockResolvedValue([{ tablename: 'tasks' }]);
    prisma.$executeRawUnsafe.mockResolvedValue(0);

    await service.onApplicationBootstrap();
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('skips TRUNCATE when the public schema returns zero tables', async () => {
    await build('true');
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    await service.onApplicationBootstrap();
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
