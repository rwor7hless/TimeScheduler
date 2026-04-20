/**
 * Budget e2e smoke: exercises the full user journey — category list
 * (seeds defaults), allocation upsert, create a transaction, fetch
 * summary/history, planned create → /convert, CSV export.
 *
 * Skips cleanly when the real DB isn't configured, matching the other
 * e2e suites.
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

maybeDescribe('budget e2e (real DB)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let token: string;
  const createdTxIds: number[] = [];
  const createdAllocIds: number[] = [];

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
    // Best-effort cleanup.
    for (const id of createdTxIds) {
      await request(app.getHttpServer())
        .delete(`/api/budget/transactions/${id}`)
        .set('Authorization', `Bearer ${token}`);
    }
    for (const id of createdAllocIds) {
      await request(app.getHttpServer())
        .delete(`/api/budget/allocations/${id}`)
        .set('Authorization', `Bearer ${token}`);
    }
    await app?.close();
    await moduleRef?.close();
  });

  const auth = (): string => `Bearer ${token}`;

  it('full round-trip: categories → allocation → tx → summary → planned → convert → history → export', async () => {
    // 1) List categories (seeds 11 defaults on first call).
    const cats = await request(app.getHttpServer())
      .get('/api/budget/categories')
      .set('Authorization', auth());
    expect(cats.status).toBe(200);
    expect(Array.isArray(cats.body)).toBe(true);
    expect(cats.body.length).toBeGreaterThanOrEqual(11);

    // 2) Upsert an allocation for a future month so we don't clash with
    // real data. Use 2099 to avoid budget-alert side effects.
    const alloc = await request(app.getHttpServer())
      .post('/api/budget/allocations')
      .set('Authorization', auth())
      .send({ year: 2099, month: 0, category: 'food', limit_amount: 1000 });
    expect(alloc.status).toBe(201);
    createdAllocIds.push(alloc.body.id);

    // Upsert again — should update, not error.
    const allocUp = await request(app.getHttpServer())
      .post('/api/budget/allocations')
      .set('Authorization', auth())
      .send({ year: 2099, month: 0, category: 'food', limit_amount: 2000 });
    expect(allocUp.status).toBe(201);
    expect(allocUp.body.limit_amount).toBe(2000);
    expect(allocUp.body.id).toBe(alloc.body.id);

    // 3) Create a transaction in that month.
    const tx = await request(app.getHttpServer())
      .post('/api/budget/transactions')
      .set('Authorization', auth())
      .send({
        type: 'expense',
        amount: 123.45,
        category: 'food',
        description: 'e2e test, quote "inside"',
        date: '2099-01-05',
        tag_ids: [],
      });
    expect(tx.status).toBe(201);
    createdTxIds.push(tx.body.id);

    // 4) Summary.
    const sum = await request(app.getHttpServer())
      .get('/api/budget/summary')
      .query({ year: 2099, month: 0 })
      .set('Authorization', auth());
    expect(sum.status).toBe(200);
    expect(sum.body).toEqual(
      expect.objectContaining({
        year: 2099,
        month: 0,
        totals: expect.objectContaining({ expense: expect.any(Number) }),
        by_category: expect.any(Array),
        daily: expect.any(Array),
        projection: expect.any(Object),
        trend: expect.any(Object),
      }),
    );
    expect(sum.body.totals.expense).toBeCloseTo(123.45, 2);

    // 5) Planned + convert.
    const planned = await request(app.getHttpServer())
      .post('/api/budget/planned')
      .set('Authorization', auth())
      .send({
        year: 2099,
        month: 0,
        amount: 50,
        category: 'food',
        description: 'future plan',
      });
    expect(planned.status).toBe(201);
    const convert = await request(app.getHttpServer())
      .post(`/api/budget/planned/${planned.body.id}/convert`)
      .set('Authorization', auth())
      .send({ date: '2099-01-06' });
    expect(convert.status).toBe(201);
    expect(convert.body.source_planned_id).toBe(planned.body.id);
    createdTxIds.push(convert.body.id);
    // Plan was deleted.
    const listPlanned = await request(app.getHttpServer())
      .get('/api/budget/planned')
      .query({ year: 2099, month: 0 })
      .set('Authorization', auth());
    expect(listPlanned.body.find((p: { id: number }) => p.id === planned.body.id)).toBeUndefined();

    // 6) History with `from` filter.
    const history = await request(app.getHttpServer())
      .get('/api/budget/history')
      .query({ from: '2099-01-01', to: '2099-01-31', limit: 100 })
      .set('Authorization', auth());
    expect(history.status).toBe(200);
    expect(history.body).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        total: expect.any(Number),
        offset: 0,
        limit: 100,
      }),
    );
    expect(history.body.total).toBeGreaterThanOrEqual(2);

    // 7) CSV export.
    const csv = await request(app.getHttpServer())
      .get('/api/budget/export')
      .query({ year: 2099, month: 0 })
      .set('Authorization', auth())
      .buffer(true)
      .parse(((res: unknown, cb: (err: Error | null, body: string) => void) => {
        let data = '';
        const stream = res as NodeJS.ReadableStream;
        stream.setEncoding('utf8');
        stream.on('data', (chunk) => (data += chunk));
        stream.on('end', () => cb(null, data));
      }) as unknown as (str: string) => string);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.headers['content-disposition']).toBe('attachment; filename="budget-2099-01.csv"');
    const body = csv.body as string;
    const lines = body.split(/\r?\n/).filter(Boolean);
    expect(lines[0]).toBe('date,type,amount,category,description,tags');
    // CSV quoting: our description has a comma and a quote.
    const descRow = lines.find((l) => l.includes('e2e test'));
    expect(descRow).toBeDefined();
    expect(descRow!).toContain('"e2e test, quote ""inside"""');
  });
});
