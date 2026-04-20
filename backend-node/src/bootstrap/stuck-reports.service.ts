import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ports the "stuck reports" recovery block from `backend/app/main.py`'s
 * `lifespan` context manager. If the previous server run crashed while a
 * weekly-report stream was in flight, the corresponding `WeeklyReport`
 * row will still have `status='in_progress'`. The SSE stream that
 * produced it is gone, so the row is effectively dead.
 *
 * On bootstrap we transition every such row to `status='error'` with a
 * descriptive message (matching the Python string verbatim), so the
 * user can retry from the UI.
 */
@Injectable()
export class StuckReportsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StuckReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const result = await this.prisma.weeklyReport.updateMany({
      where: { status: 'in_progress' },
      data: {
        status: 'error',
        error_msg: 'Генерация прервана рестартом сервера',
        updated_at: new Date(),
      },
    });

    if (result.count > 0) {
      this.logger.log(`Reset ${result.count} stuck weekly report(s) from in_progress → error`);
    }
  }
}
