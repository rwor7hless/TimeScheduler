import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@prisma/client';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';

/**
 * Thin controller test — the service has its own suite. We just verify the
 * user_id flows from `@CurrentUser()` to the service, which is the Phase 4
 * security posture we care about.
 */
describe('BoardsController', () => {
  let controller: BoardsController;
  let service: {
    list: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    reorder: jest.Mock;
  };

  const user: Partial<User> = { id: 42 };

  beforeEach(async () => {
    service = {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1, name: 'x', group_id: null, sort_order: 0, created_at: '', updated_at: '' }),
      update: jest.fn().mockResolvedValue({ id: 1, name: 'y', group_id: null, sort_order: 0, created_at: '', updated_at: '' }),
      delete: jest.fn().mockResolvedValue(undefined),
      reorder: jest.fn().mockResolvedValue({ ok: true }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoardsController],
      providers: [{ provide: BoardsService, useValue: service }],
    }).compile();
    controller = module.get(BoardsController);
  });

  it('list threads user.id through', async () => {
    await controller.list(user as User);
    expect(service.list).toHaveBeenCalledWith(42);
  });

  it('create forwards user.id + body', async () => {
    await controller.create(user as User, { name: 'n' });
    expect(service.create).toHaveBeenCalledWith(42, { name: 'n' });
  });

  it('update forwards user.id, id, body', async () => {
    await controller.update(user as User, 7, { name: 'z' });
    expect(service.update).toHaveBeenCalledWith(42, 7, { name: 'z' });
  });

  it('delete forwards user.id + id', async () => {
    await controller.delete(user as User, 7);
    expect(service.delete).toHaveBeenCalledWith(42, 7);
  });

  it('reorder forwards user.id + body', async () => {
    await controller.reorder(user as User, { group_id: 3, ordered_ids: [1, 2] });
    expect(service.reorder).toHaveBeenCalledWith(42, { group_id: 3, ordered_ids: [1, 2] });
  });
});
