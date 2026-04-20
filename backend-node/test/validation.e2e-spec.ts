/**
 * E2E proof that ValidationPipe errors flow through AllExceptionsFilter and
 * emerge as `{detail: <string>}` — no `statusCode`/`message`/`error` keys.
 *
 * Uses POST /api/admin/users because it has required fields (username,
 * password) declared in `UserCreateDto` via class-validator. We authenticate
 * as the admin so the admin guard passes — the 400 we assert on must come
 * from the ValidationPipe, not from auth/admin checks.
 *
 * Skips cleanly when DB env isn't configured, mirroring `auth.e2e-spec.ts`.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as express from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

const hasDb = Boolean(process.env.DATABASE_URL_PRISMA || process.env.DATABASE_URL);
const hasCreds = Boolean(process.env.USER_LOGIN && process.env.USER_PASSWORD);
const maybeDescribe = hasDb && hasCreds ? describe : describe.skip;

maybeDescribe('validation e2e (real DB)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(express.urlencoded({ extended: true }));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await moduleRef?.close();
  });

  it('POST /api/admin/users with missing password → 400 {detail: <string>}', async () => {
    const login = process.env.USER_LOGIN as string;
    const password = process.env.USER_PASSWORD as string;

    const tokenRes = await request(app.getHttpServer())
      .post('/api/auth/token')
      .type('form')
      .send({ username: login, password });
    expect(tokenRes.status).toBe(200);
    const token = tokenRes.body.access_token as string;

    // Missing `password` — triggers class-validator on UserCreateDto.
    const res = await request(app.getHttpServer())
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'ts-phase3-validation-check' });

    expect(res.status).toBe(400);
    // Exactly {detail} — no Nest default keys leaking through.
    expect(Object.keys(res.body)).toEqual(['detail']);
    expect(typeof res.body.detail).toBe('string');
    expect(res.body.detail.length).toBeGreaterThan(0);
  });
});
