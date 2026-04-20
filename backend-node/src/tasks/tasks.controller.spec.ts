import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@prisma/client';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

/**
 * Thin controller smoke-test. Verifies the wiring from `@CurrentUser()` +
 * `@Query()` params to the service: one shot per endpoint. Deep logic
 * lives in `tasks.service.spec.ts`.
 */
describe('TasksController', () => {
  let controller: TasksController;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let service: any;
  const user = { id: 42 } as User;

  beforeEach(async () => {
    service = {
      list: jest.fn().mockResolvedValue([]),
      listArchived: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockResolvedValue({ id: 1 }),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({ id: 1 }),
      patch: jest.fn().mockResolvedValue({ id: 1 }),
      reorder: jest.fn().mockResolvedValue({ ok: true }),
      archive: jest.fn().mockResolvedValue(undefined),
      unarchive: jest.fn().mockResolvedValue({ id: 1 }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: service }],
    }).compile();
    controller = module.get(TasksController);
  });

  it('list threads user.id + filters', async () => {
    await controller.list(
      user,
      'todo',
      'high',
      'work',
      undefined,
      undefined,
      'foo',
      '5',
      false,
      undefined,
      false,
    );
    expect(service.list).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        status: 'todo',
        priority: 'high',
        tag: 'work',
        search: 'foo',
        board_id: 5,
        default_board: false,
        include_subtasks: false,
      }),
    );
  });

  it('list silently drops unknown status/priority enum values', async () => {
    await controller.list(user, 'nope', 'nah');
    const filters = service.list.mock.calls[0][1];
    expect(filters.status).toBeUndefined();
    expect(filters.priority).toBeUndefined();
  });

  it('archived forwards user.id', async () => {
    await controller.listArchived(user);
    expect(service.listArchived).toHaveBeenCalledWith(42);
  });

  it('reorder forwards user.id + body', async () => {
    await controller.reorder(user, { status: 'done', ordered_ids: [1, 2] });
    expect(service.reorder).toHaveBeenCalledWith(42, { status: 'done', ordered_ids: [1, 2] });
  });

  it('create forwards user.id + body', async () => {
    await controller.create(user, { title: 'X' });
    expect(service.create).toHaveBeenCalledWith(42, { title: 'X' });
  });

  it('get forwards user.id + id', async () => {
    await controller.get(user, 7);
    expect(service.get).toHaveBeenCalledWith(42, 7);
  });

  it('update forwards user.id + id + body', async () => {
    await controller.update(user, 7, { title: 'X' });
    expect(service.update).toHaveBeenCalledWith(42, 7, { title: 'X' });
  });

  it('patch forwards user.id + id + body', async () => {
    await controller.patch(user, 7, { title: 'X' });
    expect(service.patch).toHaveBeenCalledWith(42, 7, { title: 'X' });
  });

  it('archive forwards user.id + id', async () => {
    await controller.archive(user, 7);
    expect(service.archive).toHaveBeenCalledWith(42, 7);
  });

  it('unarchive forwards user.id + id', async () => {
    await controller.unarchive(user, 7);
    expect(service.unarchive).toHaveBeenCalledWith(42, 7);
  });

  it('delete forwards user.id + id + permanent flag', async () => {
    await controller.delete(user, 7, true);
    expect(service.delete).toHaveBeenCalledWith(42, 7, true);
  });
});
