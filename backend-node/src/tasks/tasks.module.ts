import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TagsModule } from '../tags/tags.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TasksCleanupService } from './tasks-cleanup.service';

@Module({
  imports: [AuthModule, TagsModule],
  providers: [TasksService, TasksCleanupService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
