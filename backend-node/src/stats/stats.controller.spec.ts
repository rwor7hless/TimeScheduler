import { BadRequestException } from '@nestjs/common';
import { User } from '@prisma/client';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

describe('StatsController', () => {
  const user = { id: 7 } as User;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let svc: any;
  let controller: StatsController;
  beforeEach(() => {
    svc = { getStats: jest.fn().mockResolvedValue({}) };
    controller = new StatsController(svc as StatsService);
  });

  it('maps period=week to 7 days', async () => {
    await controller.get(user, 'week');
    expect(svc.getStats).toHaveBeenCalledWith(7, { periodDays: 7, weekStart: null });
  });

  it('defaults period to month (30)', async () => {
    await controller.get(user);
    expect(svc.getStats).toHaveBeenCalledWith(7, { periodDays: 30, weekStart: null });
  });

  it('rejects invalid period', async () => {
    expect(() => controller.get(user, 'decade')).toThrow(BadRequestException);
  });

  it('rejects week_start that is not YYYY-MM-DD', async () => {
    expect(() => controller.get(user, 'week', '04/13/2026')).toThrow(BadRequestException);
  });

  it('passes a valid week_start through', async () => {
    await controller.get(user, 'month', '2026-04-13');
    expect(svc.getStats).toHaveBeenCalledWith(7, {
      periodDays: 30,
      weekStart: '2026-04-13',
    });
  });
});
