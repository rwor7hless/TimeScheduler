import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TagsModule } from '../tags/tags.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

/**
 * Tasks module — Phase 5. Imports `TagsModule` so future callers
 * (e.g. the Phase-7 weekly report summarizer) can reuse `TagsService`
 * alongside `TasksService`. The controller itself doesn't depend on
 * `TagsService` — tag attachment runs inline against Prisma.
 */
@Module({
  imports: [AuthModule, TagsModule],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
