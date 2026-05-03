import { InternalServerErrorException } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { S3BackupService } from './s3-backup.service';

describe('BackupController', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let svc: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let s3Svc: any;
  let controller: BackupController;
  beforeEach(() => {
    svc = {
      runBackup: jest.fn(),
      listBackups: jest.fn().mockReturnValue([]),
    };
    s3Svc = { run: jest.fn() };
    controller = new BackupController(svc as BackupService, s3Svc as S3BackupService);
  });

  it('trigger echoes the full filename on success', async () => {
    svc.runBackup.mockResolvedValueOnce('/tmp/backups/backup_20260420_120000.sql');
    await expect(controller.trigger()).resolves.toEqual({
      status: 'ok',
      filename: '/tmp/backups/backup_20260420_120000.sql',
    });
  });

  it('trigger maps errors to 500 with the message as detail', async () => {
    svc.runBackup.mockRejectedValueOnce(new Error('pg_dump: connection refused'));
    await expect(controller.trigger()).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('list delegates to the service', () => {
    const rows = [{ filename: 'x.sql', size_bytes: 10, created_at: '2026-04-20T00:00:00Z' }];
    svc.listBackups.mockReturnValueOnce(rows);
    expect(controller.list()).toBe(rows);
  });
});
