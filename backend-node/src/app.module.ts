import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BackupModule } from './backup/backup.module';
import { BoardsModule } from './boards/boards.module';
import { BootstrapModule } from './bootstrap/bootstrap.module';
import { BudgetModule } from './budget/budget.module';
import { ExportModule } from './export/export.module';
import { HabitsModule } from './habits/habits.module';
import { HealthController } from './health.controller';
import { LlmModule } from './llm/llm.module';
import { NtfyModule } from './ntfy/ntfy.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { SearchModule } from './search/search.module';
import { StatsModule } from './stats/stats.module';
import { TagsModule } from './tags/tags.module';
import { TasksModule } from './tasks/tasks.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    PrismaModule,
    AuthModule,
    AdminModule,
    BoardsModule,
    TagsModule,
    TasksModule,
    HabitsModule,
    LlmModule,
    NtfyModule,
    ReportsModule,
    BudgetModule,
    TelegramModule,
    StatsModule,
    SearchModule,
    ExportModule,
    BackupModule,
    BootstrapModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
