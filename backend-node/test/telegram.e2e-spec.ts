/**
 * End-to-end smoke for Phase 9 Telegram endpoints. Skips cleanly when
 * DATABASE_URL + USER_LOGIN are absent so CI without Postgres is unaffected.
 *
 * Coverage:
 *  - GET /api/telegram/status reads current user state.
 *  - POST /api/telegram/connect with a bogus key → 404 + `{detail: ...}`.
 *  - POST /api/telegram/webhook/:secret with no header → 403.
 *
 * We don't exercise the webhook happy path: it requires a bot token,
 * public URL, and a live Telegram chat, none of which CI has.
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

maybeDescribe('telegram e2e (real DB)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let token: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(express.urlencoded({ extended: true }));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const login = process.env.USER_LOGIN as string;
    const password = process.env.USER_PASSWORD as string;
    const tokenRes = await request(app.getHttpServer())
      .post('/api/auth/token')
      .type('form')
      .send({ username: login, password });
    expect(tokenRes.status).toBe(200);
    token = tokenRes.body.access_token;
  });

  afterAll(async () => {
    await app?.close();
    await moduleRef?.close();
  });

  const auth = (): string => `Bearer ${token}`;

  it('GET /api/telegram/status returns {connected: boolean}', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/telegram/status')
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: expect.any(Boolean) });
  });

  it('POST /api/telegram/connect with bogus key → 404 {detail}', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/telegram/connect')
      .set('Authorization', auth())
      .send({ key: 'definitely-not-a-real-key-' + Date.now() });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ detail: 'Ключ не найден. Проверьте правильность.' });
  });

  it('POST /api/telegram/webhook/:secret without header → 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/telegram/webhook/whatever')
      .send({ update_id: 1 });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('detail');
  });

  it('POST /api/telegram/connect requires auth', async () => {
    const res = await request(app.getHttpServer()).post('/api/telegram/connect').send({ key: 'x' });
    expect(res.status).toBe(401);
  });
});
