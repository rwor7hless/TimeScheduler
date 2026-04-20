import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StuckReportsService } from './stuck-reports.service';

describe('StuckReportsService', () => {
  let service: StuckReportsService;
  let prisma: { weeklyReport: { updateMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { weeklyReport: { updateMany: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [StuckReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<StuckReportsService>(StuckReportsService);
  });

  it('transitions in_progress rows to error with the Russian message', async () => {
    prisma.weeklyReport.updateMany.mockResolvedValue({ count: 2 });

    await service.onApplicationBootstrap();

    expect(prisma.weeklyReport.updateMany).toHaveBeenCalledTimes(1);
    const call = prisma.weeklyReport.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ status: 'in_progress' });
    expect(call.data.status).toBe('error');
    expect(call.data.error_msg).toBe('Генерация прервана рестартом сервера');
    expect(call.data.updated_at).toBeInstanceOf(Date);
  });

  it('completes without throwing when there are no stuck rows', async () => {
    prisma.weeklyReport.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(prisma.weeklyReport.updateMany).toHaveBeenCalledTimes(1);
  });
});
