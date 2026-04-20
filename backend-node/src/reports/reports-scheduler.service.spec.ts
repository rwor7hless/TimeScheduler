import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';
import { ReportsSchedulerService } from './reports-scheduler.service';

describe('ReportsSchedulerService', () => {
  function make(llmAvailable: boolean): {
    svc: ReportsSchedulerService;
    generate: jest.Mock;
    findMany: jest.Mock;
  } {
    const findMany = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const prisma = { user: { findMany } } as unknown as PrismaService;
    const generate = jest.fn().mockResolvedValue(undefined);
    const reports = { generateReportForUser: generate } as unknown as ReportsService;
    const llm = {
      llmAvailable: () => llmAvailable,
      llmUnavailableReason: () => 'no key',
    } as unknown as LlmService;
    const config = { get: () => undefined } as unknown as ConfigService;
    return { svc: new ReportsSchedulerService(prisma, reports, llm, config), generate, findMany };
  }

  it('skips when LLM unavailable', async () => {
    const { svc, generate } = make(false);
    await svc.run();
    expect(generate).not.toHaveBeenCalled();
  });

  it('invokes generateReportForUser for each eligible user', async () => {
    const { svc, generate } = make(true);
    await svc.run();
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent runs via isRunning flag', async () => {
    const { svc, generate, findMany } = make(true);
    // Gate all generate() calls behind a single promise that we flip at end of test.
    let unblock!: () => void;
    const gate = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    generate.mockImplementation(() => gate);

    const first = svc.run();
    // Yield so the first run enters findMany + starts its first generate.
    await new Promise((r) => setImmediate(r));
    // Second call should be a no-op while the first is still in flight.
    await svc.run();
    expect(findMany).toHaveBeenCalledTimes(1);

    // Let the first run drain all users and complete.
    unblock();
    await first;
  });

  it('continues on per-user failure', async () => {
    const { svc, generate } = make(true);
    generate.mockRejectedValueOnce(new Error('bad')).mockResolvedValueOnce(undefined);
    await svc.run();
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
