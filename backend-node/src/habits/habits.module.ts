import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HabitsController } from './habits.controller';
import { HabitsService } from './habits.service';

/**
 * Habits module. No service export needed — habit data is self-contained
 * and not referenced by Tasks in Phase 5.
 */
@Module({
  imports: [AuthModule],
  providers: [HabitsService],
  controllers: [HabitsController],
})
export class HabitsModule {}
