import 'reflect-metadata';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');

  // `/api/auth/token` speaks OAuth2's password flow, which posts
  // `application/x-www-form-urlencoded`. Nest/Express parses JSON by default
  // but not URL-encoded bodies, so we mount the parser globally. This doesn't
  // affect JSON routes — the body parser selects by Content-Type.
  app.use(express.urlencoded({ extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const corsOriginsEnv = process.env.CORS_ORIGINS;
  const corsOrigins =
    corsOriginsEnv && corsOriginsEnv.trim().length > 0
      ? corsOriginsEnv
          .split(',')
          .map((o) => o.trim())
          .filter((o) => o.length > 0)
      : ['*'];

  if (corsOrigins.length === 1 && corsOrigins[0] === '*' && process.env.NODE_ENV === 'production') {
    logger.warn(
      'CORS_ORIGINS is "*" in production — credentialed requests are reflected from any origin. Set CORS_ORIGINS to an explicit allow-list.',
    );
  }

  app.enableCors({
    origin: corsOrigins.length === 1 && corsOrigins[0] === '*' ? true : corsOrigins,
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  logger.log(`Listening on ${port}, /api prefix active`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap application', err);
  process.exit(1);
});
