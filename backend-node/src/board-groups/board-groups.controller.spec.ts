import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@prisma/client';
import { BoardGroupsController } from './board-groups.controller';
import { BoardGroupsService } from './board-groups.service';

describe('BoardGroupsController', () => {
  let controller: BoardGroupsController;
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
      create: jest.fn().mockResolvedValue({
        id: 1, name: 'g', sort_order: 0, created_at: '', updated_at: '',
      }),
      update: jest.fn().mockResolvedValue({
        id: 1, name: 'g2', sort_order: 0, created_at: '', updated_at: '',
      }),
      delete: jest.fn().mockResolvedValue(undefined),
      reorder: jest.fn().mockResolvedValue({ ok: true }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoardGroupsController],
      providers: [{ provide: BoardGroupsService, useValue: service }],
    }).compile();
    controller = module.get(BoardGroupsController);
  });

  it('list threads user.id', async () => {
    await controller.list(user as User);
    expect(service.list).toHaveBeenCalledWith(42);
  });

  it('create forwards user.id + body', async () => {
    await controller.create(user as User, { name: 'g' });
    expect(service.create).toHaveBeenCalledWith(42, { name: 'g' });
  });

  it('update forwards user.id, id, body', async () => {
    await controller.update(user as User, 7, { name: 'g2' });
    expect(service.update).toHaveBeenCalledWith(42, 7, { name: 'g2' });
  });

  it('delete defaults cascade=false when query omitted', async () => {
    await controller.delete(user as User, 7, undefined as unknown as boolean);
    expect(service.delete).toHaveBeenCalledWith(42, 7, false);
  });

  it('delete forwards cascade=true', async () => {
    await controller.delete(user as User, 7, true);
    expect(service.delete).toHaveBeenCalledWith(42, 7, true);
  });

  it('reorder forwards user.id + body', async () => {
    await controller.reorder(user as User, { ordered_ids: [3, 1, 2] });
    expect(service.reorder).toHaveBeenCalledWith(42, { ordered_ids: [3, 1, 2] });
  });
});
