import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, Tag } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TagsService } from './tags.service';

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return { id: 1, name: 'work', color: '#6B7280', user_id: 1, ...overrides };
}

describe('TagsService', () => {
  let service: TagsService;
  let prisma: {
    tag: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      tag: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TagsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(TagsService);
  });

  describe('list', () => {
    it('scopes by user_id, orders by name asc, strips user_id from response', async () => {
      prisma.tag.findMany.mockResolvedValue([makeTag({ id: 1, name: 'alpha' })]);
      const result = await service.list(1);
      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        where: { user_id: 1 },
        orderBy: { name: 'asc' },
      });
      expect(result[0]).toEqual({ id: 1, name: 'alpha', color: '#6B7280' });
      expect(result[0]).not.toHaveProperty('user_id');
    });
  });

  describe('create', () => {
    it('rejects duplicate (user_id, name) with 400 matching Python message', async () => {
      // Python returns "Tag with this name already exists" — byte-exact per
      // `backend/app/routers/tags.py` line 34.
      prisma.tag.findFirst.mockResolvedValue(makeTag());
      await expect(service.create(1, { name: 'work' })).rejects.toMatchObject({
        message: 'Tag with this name already exists',
      });
      await expect(service.create(1, { name: 'work' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('applies default color #6B7280 when color is omitted', async () => {
      prisma.tag.findFirst.mockResolvedValue(null);
      prisma.tag.create.mockResolvedValue(makeTag({ color: '#6B7280' }));
      await service.create(1, { name: 'new' });
      expect(prisma.tag.create).toHaveBeenCalledWith({
        data: { user_id: 1, name: 'new', color: '#6B7280' },
      });
    });

    it('maps Prisma P2002 to 400 for the TOCTOU race', async () => {
      prisma.tag.findFirst.mockResolvedValue(null);
      const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x',
      });
      prisma.tag.create.mockRejectedValue(p2002);
      await expect(service.create(1, { name: 'x' })).rejects.toMatchObject({
        message: 'Tag with this name already exists',
      });
    });
  });

  describe('delete', () => {
    it('404s on foreign tag', async () => {
      prisma.tag.findFirst.mockResolvedValue(null);
      await expect(service.delete(1, 99)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.tag.delete).not.toHaveBeenCalled();
    });

    it('deletes when owned — task_tags rows drop via FK cascade (not tested here)', async () => {
      prisma.tag.findFirst.mockResolvedValue(makeTag());
      prisma.tag.delete.mockResolvedValue(undefined);
      await service.delete(1, 1);
      expect(prisma.tag.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
