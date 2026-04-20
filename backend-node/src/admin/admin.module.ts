import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * Admin module. Depends on AuthModule for:
 *   - `AuthService.hashPassword` (used when creating new users)
 *   - the shared PassportModule + JwtModule bindings so `JwtAuthGuard` works
 *
 * PrismaService is injected globally via `@Global() PrismaModule`.
 */
@Module({
  imports: [AuthModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
