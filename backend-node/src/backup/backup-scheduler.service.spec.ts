import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BackupService } from './backup.service';
import { BackupSchedulerService } from './backup-scheduler.service';

function cfgFor(values: Record<string, string | undefined>): ConfigService {
  return { get: <T>(k: string): T | undefined => values[k] as unknown as T } as ConfigService;
}

describe('BackupSchedulerService', () => {
  let registry: { addInterval: jest.Mock };
  let backup: { runBackup: jest.Mock };
  beforeEach(() => {
    registry = { addInterval: jest.fn() };
    backup = { runBackup: jest.fn().mockResolvedValue('/tmp/out.sql') };
  });

  it('registers an interval based on BACKUP_INTERVAL_HOURS', () => {
    const s = new BackupSchedulerService(
      cfgFor({ BACKUP_INTERVAL_HOURS: '1' }),
      registry as unknown as SchedulerRegistry,
      backup as unknown as BackupService,
    );
    s.onModuleInit();
    expect(registry.addInterval).toHaveBeenCalledWith('backup-interval', expect.anything());
    // Clear the real interval so Jest exits.
    const handle = registry.addInterval.mock.calls[0][1] as NodeJS.Timeout;
    clearInterval(handle);
  });

  it('does not register when BACKUP_INTERVAL_HOURS is invalid', () => {
    const s = new BackupSchedulerService(
      cfgFor({ BACKUP_INTERVAL_HOURS: 'oops' }),
      registry as unknown as SchedulerRegistry,
      backup as unknown as BackupService,
    );
    s.onModuleInit();
    expect(registry.addInterval).not.toHaveBeenCalled();
  });

  it('tick dedupes overlapping runs with isRunning', async () => {
    const s = new BackupSchedulerService(
      cfgFor({ BACKUP_INTERVAL_HOURS: '24' }),
      registry as unknown as SchedulerRegistry,
      backup as unknown as BackupService,
    );
    let release!: () => void;
    backup.runBackup.mockImplementationOnce(
      () => new Promise<string>((resolve) => (release = () => resolve('/tmp/ok.sql'))),
    );
    const first = s.tick();
    const second = s.tick();
    release();
    await first;
    await second;
    expect(backup.runBackup).toHaveBeenCalledTimes(1);
  });

  it('tick swallows errors so the cron survives bad runs', async () => {
    backup.runBackup.mockRejectedValueOnce(new Error('boom'));
    const s = new BackupSchedulerService(
      cfgFor({ BACKUP_INTERVAL_HOURS: '24' }),
      registry as unknown as SchedulerRegistry,
      backup as unknown as BackupService,
    );
    await expect(s.tick()).resolves.toBeUndefined();
  });
});
