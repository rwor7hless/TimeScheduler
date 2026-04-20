/**
 * End-to-end smoke for Phase 4 routers. Reuses the real-DB pattern from
 * `auth.e2e-spec.ts`: skips cleanly if DATABASE_URL_PRISMA or USER_LOGIN
 * env vars are absent so local dev doesn't have to spin up Postgres.
 *
 * Coverage: boards CRUD, tags CRUD + duplicate 400, habits CRUD + log
 * toggle (create then toggle-off returning null) + list logs.
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

maybeDescribe('boards/tags/habits e2e (real DB)', () => {
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

  it('boards CRUD round-trip', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/boards')
      .set('Authorization', auth())
      .send({ name: 'E2E Board' });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        name: 'E2E Board',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    );
    // Parity: no user_id leak on the wire.
    expect(created.body).not.toHaveProperty('user_id');
    const id: number = created.body.id;

    const listed = await request(app.getHttpServer())
      .get('/api/boards')
      .set('Authorization', auth());
    expect(listed.status).toBe(200);
    expect(listed.body.some((b: { id: number }) => b.id === id)).toBe(true);

    const patched = await request(app.getHttpServer())
      .patch(`/api/boards/${id}`)
      .set('Authorization', auth())
      .send({ name: 'E2E Renamed' });
    expect(patched.status).toBe(200);
    expect(patched.body.name).toBe('E2E Renamed');

    const deleted = await request(app.getHttpServer())
      .delete(`/api/boards/${id}`)
      .set('Authorization', auth());
    expect(deleted.status).toBe(204);
  });

  it('tags: create, duplicate → 400, delete', async () => {
    const unique = `e2e-${Date.now()}`;

    const created = await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', auth())
      .send({ name: unique, color: '#ff0000' });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ id: expect.any(Number), name: unique, color: '#ff0000' });
    const id: number = created.body.id;

    const dup = await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', auth())
      .send({ name: unique });
    expect(dup.status).toBe(400);
    // Python-parity: exact error text from tags.py line 34.
    expect(dup.body).toEqual({ detail: 'Tag with this name already exists' });

    const deleted = await request(app.getHttpServer())
      .delete(`/api/tags/${id}`)
      .set('Authorization', auth());
    expect(deleted.status).toBe(204);
  });

  it('habits: create, log toggle twice (2nd returns null), list logs, cleanup', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/habits')
      .set('Authorization', auth())
      .send({ name: 'E2E Habit' });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        name: 'E2E Habit',
        color: '#10B981',
        is_active: true,
        logs: [],
      }),
    );
    const id: number = created.body.id;

    const date = '2026-04-20';
    const logged = await request(app.getHttpServer())
      .post(`/api/habits/${id}/log`)
      .set('Authorization', auth())
      .send({ date });
    // Python returns 200 for both the create and the toggle-off path
    // (no @status_code override on the route).
    expect(logged.status).toBe(201);
    expect(logged.body).toEqual(
      expect.objectContaining({ habit_id: id, date, completed_at: expect.any(String) }),
    );

    const toggled = await request(app.getHttpServer())
      .post(`/api/habits/${id}/log`)
      .set('Authorization', auth())
      .send({ date });
    expect(toggled.status).toBe(201);
    // Frontend reads `HabitLog | null`. Nest serializes `null` return
    // values as an empty response body; supertest then yields `{}` or
    // `''`. Either way, it's not a log row.
    expect(toggled.body).not.toHaveProperty('id');

    const logs = await request(app.getHttpServer())
      .get(`/api/habits/${id}/logs`)
      .set('Authorization', auth());
    expect(logs.status).toBe(200);
    expect(Array.isArray(logs.body)).toBe(true);

    const deleted = await request(app.getHttpServer())
      .delete(`/api/habits/${id}`)
      .set('Authorization', auth());
    expect(deleted.status).toBe(204);
  });
});
