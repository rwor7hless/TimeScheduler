import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';

/**
 * Boards module. Imports AuthModule for JwtAuthGuard's shared
 * JwtModule/PassportModule wiring. PrismaService is available globally.
 *
 * BoardsService is not exported — Phase 5 (Tasks) will reference
 * `board_id` directly on the Task row, so it doesn't need a service call
 * to read the board list.
 */
@Module({
  imports: [AuthModule],
  providers: [BoardsService],
  controllers: [BoardsController],
})
export class BoardsModule {}
