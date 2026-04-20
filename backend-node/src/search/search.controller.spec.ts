import { BadRequestException } from '@nestjs/common';
import { User } from '@prisma/client';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

describe('SearchController', () => {
  const user = { id: 1 } as User;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let svc: any;
  let controller: SearchController;
  beforeEach(() => {
    svc = { search: jest.fn().mockResolvedValue({ tasks: [], habits: [], boards: [] }) };
    controller = new SearchController(svc as SearchService);
  });

  it('rejects missing q', async () => {
    expect(() => controller.do(user, undefined)).toThrow(BadRequestException);
  });

  it('rejects empty q', async () => {
    expect(() => controller.do(user, '')).toThrow(BadRequestException);
  });

  it('rejects q longer than 200 chars', async () => {
    expect(() => controller.do(user, 'x'.repeat(201))).toThrow(BadRequestException);
  });

  it('passes q through to the service', async () => {
    await controller.do(user, 'shipping');
    expect(svc.search).toHaveBeenCalledWith(1, 'shipping');
  });
});
