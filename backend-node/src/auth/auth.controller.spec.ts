import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@prisma/client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    validateUser: jest.Mock;
    createAccessToken: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      validateUser: jest.fn(),
      createAccessToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('POST /auth/token', () => {
    it('returns {access_token, token_type: "bearer"} on valid credentials', async () => {
      authService.validateUser.mockResolvedValue({ id: 1, username: 'alice' });
      authService.createAccessToken.mockResolvedValue('signed.jwt.token');

      const result = await controller.login({ username: 'alice', password: 'pw' });

      expect(authService.validateUser).toHaveBeenCalledWith('alice', 'pw');
      expect(authService.createAccessToken).toHaveBeenCalledWith(1, 'alice');
      expect(result).toEqual({ access_token: 'signed.jwt.token', token_type: 'bearer' });
    });

    it('throws 401 UnauthorizedException with Python-parity message on bad creds', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(controller.login({ username: 'x', password: 'y' })).rejects.toMatchObject({
        message: 'Incorrect username or password',
      });
      await expect(controller.login({ username: 'x', password: 'y' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('GET /auth/me', () => {
    it('returns {username, user_id, is_admin, can_request_summary}', async () => {
      const user = {
        id: 42,
        username: 'alice',
        is_admin: true,
        can_request_summary: false,
        password_hash: 'x',
        created_at: new Date(),
        telegram_chat_id: null,
        telegram_key: null,
      } satisfies User;

      const result = await controller.me(user);

      expect(result).toEqual({
        username: 'alice',
        user_id: 42,
        is_admin: true,
        can_request_summary: false,
      });
    });
  });
});
