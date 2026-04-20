import { User } from '@prisma/client';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

function user(o: Partial<User> = {}): User {
  return { id: 1, username: 'u', is_admin: false, can_request_summary: false, ...o } as User;
}

describe('ReportsController', () => {
  function make(): { ctrl: ReportsController; svc: jest.Mocked<ReportsService> } {
    const svc = {
      list: jest.fn().mockResolvedValue([]),
      generate: jest.fn().mockResolvedValue({ id: 1 }),
      requestSummary: jest.fn().mockResolvedValue({ id: 2 }),
      testPush: jest.fn().mockResolvedValue({ ok: true }),
      dailyTip: jest.fn().mockResolvedValue({ tip: 't', date: '2026-04-20' }),
    } as unknown as jest.Mocked<ReportsService>;
    return { ctrl: new ReportsController(svc), svc };
  }

  it('list clamps limit into [1, 50]', async () => {
    const { ctrl, svc } = make();
    await ctrl.list(user(), 999);
    expect(svc.list).toHaveBeenCalledWith(1, 50);
    await ctrl.list(user(), 0);
    expect(svc.list).toHaveBeenCalledWith(1, 1);
  });

  it('generate forwards week_start', async () => {
    const { ctrl, svc } = make();
    await ctrl.generate(user(), { week_start: '2026-04-13' });
    expect(svc.generate).toHaveBeenCalledWith(1, '2026-04-13');
  });

  it('requestSummary passes user through', async () => {
    const { ctrl, svc } = make();
    const u = user({ can_request_summary: true });
    await ctrl.requestSummary(u);
    expect(svc.requestSummary).toHaveBeenCalledWith(u);
  });

  it('testPush and dailyTip delegate', async () => {
    const { ctrl, svc } = make();
    await ctrl.testPush();
    expect(svc.testPush).toHaveBeenCalled();
    await ctrl.dailyTip(user());
    expect(svc.dailyTip).toHaveBeenCalledWith(1);
  });
});
