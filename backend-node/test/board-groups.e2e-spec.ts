/**
 * End-to-end smoke for board-groups. Skips when DB or admin creds are missing,
 * matching the existing convention in test/boards-tags-habits.e2e-spec.ts.
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

maybeDescribe('board-groups e2e (real DB)', () => {
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
      .send({ username: process.env.USER_LOGIN, password: process.env.USER_PASSWORD });
    expect(tokenRes.status).toBe(200);
    token = tokenRes.body.access_token;
  });

  afterAll(async () => {
    await app?.close();
    await moduleRef?.close();
  });

  const auth = (): string => `Bearer ${token}`;

  it('happy path: create group → create list in group → move list out → delete group cascade=false leaves list at top-level', async () => {
    // 1. Create group
    const groupRes = await request(app.getHttpServer())
      .post('/api/board-groups')
      .set('Authorization', auth())
      .send({ name: 'E2E Group' });
    expect(groupRes.status).toBe(201);
    expect(groupRes.body).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        name: 'E2E Group',
        sort_order: 0,
        created_at: expect.any(String),
      }),
    );
    const groupId: number = groupRes.body.id;

    // 2. Create list inside the group
    const listRes = await request(app.getHttpServer())
      .post('/api/boards')
      .set('Authorization', auth())
      .send({ name: 'E2E List', group_id: groupId });
    expect(listRes.status).toBe(201);
    expect(listRes.body.group_id).toBe(groupId);
    const listId: number = listRes.body.id;

    // 3. Move list to top-level (group_id=null)
    const movedRes = await request(app.getHttpServer())
      .patch(`/api/boards/${listId}`)
      .set('Authorization', auth())
      .send({ group_id: null, sort_order: 0 });
    expect(movedRes.status).toBe(200);
    expect(movedRes.body.group_id).toBeNull();

    // Move it back into the group for the deletion cascade test.
    await request(app.getHttpServer())
      .patch(`/api/boards/${listId}`)
      .set('Authorization', auth())
      .send({ group_id: groupId });

    // 4. Delete the group with cascade=false (default).
    const delRes = await request(app.getHttpServer())
      .delete(`/api/board-groups/${groupId}`)
      .set('Authorization', auth());
    expect(delRes.status).toBe(204);

    // 5. The list survives at top-level (FK SET NULL did its job).
    const checkRes = await request(app.getHttpServer())
      .get('/api/boards')
      .set('Authorization', auth());
    const list = checkRes.body.find((b: { id: number }) => b.id === listId);
    expect(list).toBeDefined();
    expect(list.group_id).toBeNull();

    // Cleanup: delete the orphaned list so the test is idempotent.
    await request(app.getHttpServer())
      .delete(`/api/boards/${listId}`)
      .set('Authorization', auth());
  });

  it('reorder updates sort_order in given sequence', async () => {
    const a = (await request(app.getHttpServer()).post('/api/board-groups').set('Authorization', auth()).send({ name: 'A' })).body;
    const b = (await request(app.getHttpServer()).post('/api/board-groups').set('Authorization', auth()).send({ name: 'B' })).body;
    const c = (await request(app.getHttpServer()).post('/api/board-groups').set('Authorization', auth()).send({ name: 'C' })).body;

    const r = await request(app.getHttpServer())
      .patch('/api/board-groups/reorder')
      .set('Authorization', auth())
      .send({ ordered_ids: [c.id, a.id, b.id] });
    expect(r.status).toBe(200);

    const listed = (await request(app.getHttpServer()).get('/api/board-groups').set('Authorization', auth())).body;
    const ids = listed.filter((g: { id: number }) => [a.id, b.id, c.id].includes(g.id)).map((g: { id: number }) => g.id);
    expect(ids).toEqual([c.id, a.id, b.id]);

    // Cleanup
    for (const id of [a.id, b.id, c.id]) {
      await request(app.getHttpServer()).delete(`/api/board-groups/${id}`).set('Authorization', auth());
    }
  });
});
