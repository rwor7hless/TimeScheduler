/**
 * Phase 10 e2e smoke for /api/stats + /api/search + /api/export. Skips
 * cleanly when the real DB env isn't set, same pattern as earlier phases.
 * Doesn't exercise /api/backup because pg_dump may not be in PATH locally.
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

maybeDescribe('phase-10 e2e (real DB)', () => {
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

    const tokenRes = await request(app.getHttpServer())
      .post('/api/auth/token')
      .type('form')
      .send({
        username: process.env.USER_LOGIN as string,
        password: process.env.USER_PASSWORD as string,
      });
    expect(tokenRes.status).toBe(200);
    token = tokenRes.body.access_token;
  });

  afterAll(async () => {
    await app?.close();
    await moduleRef?.close();
  });

  const auth = (): string => `Bearer ${token}`;

  it('GET /api/stats?period=week returns the full nested shape', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/stats')
      .query({ period: 'week' })
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    for (const key of [
      'active_tasks',
      'completed_last_month',
      'overdue_count',
      'avg_completion_hours',
      'productivity_percent',
      'most_active_hours',
      'habit_progress',
      'daily_completions',
      'by_priority',
      'by_board',
      'by_tag',
      'week_start',
      'previous_period_metrics',
    ]) {
      expect(body).toHaveProperty(key);
    }
    expect(Array.isArray(body.most_active_hours)).toBe(true);
    expect(body.week_start).toBeNull();
    expect(body.previous_period_metrics).toBeNull();
  });

  it('GET /api/stats?week_start=... populates previous_period_metrics', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/stats')
      .query({ week_start: '2026-04-13' })
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.week_start).toBe('2026-04-13');
    expect(res.body.previous_period_metrics).toMatchObject({
      completed_count: expect.any(Number),
      active_days: expect.any(Number),
    });
  });

  it('GET /api/stats rejects invalid period', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/stats')
      .query({ period: 'decade' })
      .set('Authorization', auth());
    expect(res.status).toBe(400);
  });

  it('GET /api/search returns { tasks, habits, boards } with type discriminators', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/search')
      .query({ q: 'a' })
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tasks)).toBe(true);
    expect(Array.isArray(res.body.habits)).toBe(true);
    expect(Array.isArray(res.body.boards)).toBe(true);
    for (const t of res.body.tasks) expect(t.type).toBe('task');
    for (const h of res.body.habits) expect(h.type).toBe('habit');
    for (const b of res.body.boards) expect(b.type).toBe('board');
  });

  it('GET /api/search rejects empty q', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/search')
      .query({ q: '' })
      .set('Authorization', auth());
    expect(res.status).toBe(400);
  });

  it('GET /api/export/tasks?format=csv returns a CSV blob', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/export/tasks')
      .query({ format: 'csv' })
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('tasks.csv');
  });

  it('GET /api/export/stats?format=json returns the stats payload', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/export/stats')
      .query({ format: 'json', period: 'week' })
      .set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('stats.json');
    const parsed = JSON.parse(res.text ?? String(res.body));
    expect(parsed).toHaveProperty('active_tasks');
  });
});
