/**
 * End-to-end smoke for Phase 5 (Tasks). Same skip-if-no-DB pattern as
 * `boards-tags-habits.e2e-spec.ts`. Covers the full lifecycle:
 * login → create → list → patch → reorder → archive → unarchive →
 * soft-delete (default list hides it) → hard delete.
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

maybeDescribe('tasks e2e (real DB)', () => {
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

  it('full lifecycle: create → list → patch → reorder → archive → unarchive → soft/hard delete', async () => {
    const tagUnique = `tasktag-${Date.now()}`;
    const tag = await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', auth())
      .send({ name: tagUnique, color: '#112233' });
    expect(tag.status).toBe(201);
    const tagId: number = tag.body.id;

    const created = await request(app.getHttpServer())
      .post('/api/tasks')
      .set('Authorization', auth())
      .send({ title: 'E2E Task', priority: 'high', tag_ids: [tagId] });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        title: 'E2E Task',
        priority: 'high',
        done: false,
        subtasks: [],
      }),
    );
    expect(Array.isArray(created.body.tags)).toBe(true);
    expect(created.body.tags.some((t: { id: number }) => t.id === tagId)).toBe(true);
    const id: number = created.body.id;

    const listed = await request(app.getHttpServer())
      .get('/api/tasks?done=false')
      .set('Authorization', auth());
    expect(listed.status).toBe(200);
    expect(listed.body.some((t: { id: number }) => t.id === id)).toBe(true);

    const patched = await request(app.getHttpServer())
      .patch(`/api/tasks/${id}`)
      .set('Authorization', auth())
      .send({ title: 'E2E Renamed', done: true });
    expect(patched.status).toBe(200);
    expect(patched.body.title).toBe('E2E Renamed');
    expect(patched.body.done).toBe(true);
    expect(patched.body.completed_at).not.toBeNull();

    const reordered = await request(app.getHttpServer())
      .patch('/api/tasks/reorder')
      .set('Authorization', auth())
      .send({ ordered_ids: [id] });
    expect(reordered.status).toBe(200);
    expect(reordered.body).toEqual({ ok: true });

    const afterReorder = await request(app.getHttpServer())
      .get(`/api/tasks/${id}`)
      .set('Authorization', auth());
    expect(afterReorder.body.position).toBe(0);

    const archived = await request(app.getHttpServer())
      .post(`/api/tasks/${id}/archive`)
      .set('Authorization', auth());
    expect(archived.status).toBe(204);

    const archivedList = await request(app.getHttpServer())
      .get('/api/tasks/archived')
      .set('Authorization', auth());
    expect(archivedList.status).toBe(200);
    expect(archivedList.body.some((t: { id: number }) => t.id === id)).toBe(true);

    const unarchived = await request(app.getHttpServer())
      .post(`/api/tasks/${id}/unarchive`)
      .set('Authorization', auth());
    expect(unarchived.status).toBe(201);
    expect(unarchived.body.is_archived).toBe(false);

    // Soft delete
    const softDeleted = await request(app.getHttpServer())
      .delete(`/api/tasks/${id}`)
      .set('Authorization', auth());
    expect(softDeleted.status).toBe(204);

    const afterSoft = await request(app.getHttpServer())
      .get('/api/tasks')
      .set('Authorization', auth());
    expect(afterSoft.body.some((t: { id: number }) => t.id === id)).toBe(false);

    // Hard delete to clean up
    const hard = await request(app.getHttpServer())
      .delete(`/api/tasks/${id}?permanent=true`)
      .set('Authorization', auth());
    // Task was soft-deleted; the route still resolves because the
    // scoped findFirst doesn't filter by deleted_at on the delete route.
    // If an impl choice changes, accept 204 or 404.
    expect([204, 404]).toContain(hard.status);

    await request(app.getHttpServer()).delete(`/api/tags/${tagId}`).set('Authorization', auth());
  });

  it('search escapes % so literal foo%bar does not match fooXbar', async () => {
    const a = await request(app.getHttpServer())
      .post('/api/tasks')
      .set('Authorization', auth())
      .send({ title: 'foo%bar search marker' });
    const b = await request(app.getHttpServer())
      .post('/api/tasks')
      .set('Authorization', auth())
      .send({ title: 'fooXbar other marker' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);

    const r = await request(app.getHttpServer())
      .get('/api/tasks?search=foo%25bar')
      .set('Authorization', auth());
    expect(r.status).toBe(200);
    const titles: string[] = r.body.map((t: { title: string }) => t.title);
    expect(titles).toContain('foo%bar search marker');
    expect(titles).not.toContain('fooXbar other marker');

    await request(app.getHttpServer())
      .delete(`/api/tasks/${a.body.id}?permanent=true`)
      .set('Authorization', auth());
    await request(app.getHttpServer())
      .delete(`/api/tasks/${b.body.id}?permanent=true`)
      .set('Authorization', auth());
  });
});
