import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BoardGroupsController } from './board-groups.controller';
import { BoardGroupsService } from './board-groups.service';

@Module({
  imports: [AuthModule],
  providers: [BoardGroupsService],
  controllers: [BoardGroupsController],
})
export class BoardGroupsModule {}
