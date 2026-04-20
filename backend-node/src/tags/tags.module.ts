import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

/**
 * Tags module. Exports TagsService because Phase 5 (Tasks) will consume it
 * when attaching/detaching tags to a task via `task_tags`.
 */
@Module({
  imports: [AuthModule],
  providers: [TagsService],
  controllers: [TagsController],
  exports: [TagsService],
})
export class TagsModule {}
