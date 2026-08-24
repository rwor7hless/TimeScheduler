import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User, WeeklyReport } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportsService } from './reports.service';

/**
 * `/api/reports` — ports `backend/app/routers/reports.py`.
 *
 * Route ordering: static paths (`/generate`, `/request-summary`,
 * `/test-push`) are declared here. The SSE endpoint `/:id/stream`
 * lives in `report-stream.controller.ts` — same base path, but the
 * `@Res()` escape hatch is isolated so it's obvious at review time
 * that the stream controller deliberately bypasses the interceptor
 * chain.
 */
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<WeeklyReport[]> {
    const clamped = Math.min(Math.max(limit, 1), 50);
    return this.reports.list(user.id, clamped);
  }

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  generate(@CurrentUser() user: User, @Query() query: GenerateReportDto): Promise<WeeklyReport> {
    return this.reports.generate(user.id, query.week_start);
  }

  @Post('request-summary')
  requestSummary(@CurrentUser() user: User): Promise<WeeklyReport> {
    return this.reports.requestSummary(user);
  }

  @Post('test-push')
  testPush(): Promise<{ ok: boolean; topic?: string; server?: string; error?: string }> {
    return this.reports.testPush();
  }
}
