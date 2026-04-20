import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Auth module. Registers the JwtModule asynchronously so we can read
 * `SECRET_KEY` + `JWT_EXPIRE_MINUTES` from ConfigService (which is wired in
 * AppModule with `ConfigModule.forRoot({isGlobal: true})`).
 *
 * Exports AuthService, JwtModule, and PassportModule so feature modules
 * (AdminModule, BootstrapModule) can depend on them without re-registering
 * JWT settings.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('SECRET_KEY'),
        // We deliberately DO NOT set `signOptions.expiresIn` here. The
        // jsonwebtoken library errors if both `expiresIn` and a payload
        // `exp` are supplied; our AuthService embeds `exp` directly in the
        // payload to match Python's `create_access_token` byte-for-byte.
        signOptions: { algorithm: 'HS256' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
