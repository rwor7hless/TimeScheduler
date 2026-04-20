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

/**
 * `/api/backup/*` — ports `backend/app/routers/backup.py`. Admin-only, both
 * endpoints. Shell-level failures from `pg_dump` bubble up as 500s with the
 * stderr content in `detail`, matching Python.
 */
@Controller('backup')
@UseGuards(JwtAuthGuard, AdminGuard)
export class BackupController {
  constructor(private readonly backup: BackupService) {}

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

  @Get('list')
  list(): BackupEntry[] {
    return this.backup.listBackups();
  }
}
