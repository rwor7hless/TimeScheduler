/**
 * End-to-end smoke of the auth surface. Boots the full Nest app via
 * `Test.createTestingModule({imports: [AppModule]})` and exercises the live
 * HTTP routes — this is how we prove the whole stack wires together
 * correctly:
 *
 *   - `express.urlencoded()` is mounted (POST /api/auth/token takes
 *     application/x-www-form-urlencoded).
 *   - `ValidationPipe` + `ClassSerializerInterceptor` compose so the
 *     response DTO ships exactly {username, user_id, is_admin,
 *     can_request_summary} without strays like password_hash leaking.
 *   - `JwtAuthGuard` rejects missing-header requests with 401.
 *   - Bad credentials also 401.
 *
 * The test hits the real Postgres via PrismaService, so it skips cleanly
 * when the DB env isn't configured — mirrors the pattern in
 * `argon2-portability.e2e-spec.ts`.
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

maybeDescribe('auth e2e (real DB)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mirror the production wiring in `main.ts` so the e2e test is a
    // faithful integration check. ValidationPipe + urlencoded body parser
    // are the two bits of global config the OAuth2 form-post depends on.
    app.setGlobalPrefix('api');
    app.use(express.urlencoded({ extended: true }));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    // Mirror the production filter wiring so error-shape assertions below
    // exercise the actual {detail} normalizer.
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await moduleRef?.close();
  });

  const login = process.env.USER_LOGIN as string;
  const password = process.env.USER_PASSWORD as string;

  it('POST /api/auth/token returns {access_token, token_type:"bearer"} on valid creds', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/token')
      .type('form')
      .send({ username: login, password });

    expect(res.status).toBe(200);
    expect(typeof res.body.access_token).toBe('string');
    expect(res.body.access_token.length).toBeGreaterThan(0);
    expect(res.body.token_type).toBe('bearer');
  });

  it('GET /api/auth/me returns exactly {username, user_id, is_admin, can_request_summary}', async () => {
    const tokenRes = await request(app.getHttpServer())
      .post('/api/auth/token')
      .type('form')
      .send({ username: login, password });
    expect(tokenRes.status).toBe(200);
    const token = tokenRes.body.access_token as string;

    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Key set must be exactly these four — no password_hash, telegram_*,
    // created_at, etc. leaking through the /me response contract.
    expect(Object.keys(res.body).sort()).toEqual(
      ['can_request_summary', 'is_admin', 'user_id', 'username'].sort(),
    );
    expect(res.body.username).toBe(login);
    expect(typeof res.body.user_id).toBe('number');
    expect(typeof res.body.is_admin).toBe('boolean');
    expect(typeof res.body.can_request_summary).toBe('boolean');
  });

  it('POST /api/auth/token with wrong password → 401 {detail}', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/token')
      .type('form')
      .send({ username: login, password: `${password}-not-the-real-one` });

    expect(res.status).toBe(401);
    // Phase 3 shape: exactly {detail: <string>} — no statusCode/message/error
    // keys from Nest's default response body.
    expect(Object.keys(res.body)).toEqual(['detail']);
    expect(res.body.detail).toBe('Incorrect username or password');
  });

  it('GET /api/auth/me with no Authorization header → 401 {detail}', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(Object.keys(res.body)).toEqual(['detail']);
    expect(typeof res.body.detail).toBe('string');
    expect(res.body.detail.length).toBeGreaterThan(0);
  });
});
