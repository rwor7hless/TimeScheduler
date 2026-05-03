import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackupEntry, BackupService } from './backup.service';
import { BackupResult, S3BackupService } from './s3-backup.service';

/**
 * `/api/backup/*` — ports `backend/app/routers/backup.py`. Admin-only, both
 * endpoints. Shell-level failures from `pg_dump` bubble up as 500s with the
 * stderr content in `detail`, matching Python.
 */
@Controller('backup')
@UseGuards(JwtAuthGuard, AdminGuard)
export class BackupController {
  constructor(
    private readonly backup: BackupService,
    private readonly s3Backup: S3BackupService,
  ) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  async trigger(): Promise<{ status: 'ok'; filename: string }> {
    try {
      const fullPath = await this.backup.runBackup();
      // Python returns the full path (os.path.join(backup_dir, ...)) from
      // run_backup and echoes it in the response. Match verbatim.
      return { status: 'ok', filename: fullPath };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(msg);
    }
  }

  @Post('s3-trigger')
  @HttpCode(HttpStatus.OK)
  async triggerS3(): Promise<{ status: 'ok' } & BackupResult> {
    try {
      const result = await this.s3Backup.run();
      return { status: 'ok', ...result };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(msg);
    }
  }

  @Get('list')
  list(): BackupEntry[] {
    return this.backup.listBackups();
  }
}
