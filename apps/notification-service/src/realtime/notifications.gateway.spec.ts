import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import type { JwtAccessPayload } from '@app/common-dto';
import type { RedisService } from '../redis/redis.service';
import { NotificationsGateway } from './notifications.gateway';

/**
 * 25/08/2026: unit test moi cho fix ra soat bao mat - xem giai thich day du tai
 * apps/analytics-service/src/realtime/analytics.gateway.spec.ts (cung 1 fix, cung ly do). File
 * nay truoc do KHONG co spec nao ca.
 */
describe('NotificationsGateway.handleConnection', () => {
  const PAYLOAD: JwtAccessPayload = {
    sub: 'user-1',
    organizationId: 'org-1',
    departmentId: null,
    // 16/09/2026: bo sung isSuperAdmin - truong bat buoc tu JwtAccessPayload sau tinh nang moi
    // "Super Admin" (xem auth-context.interface.ts), thieu truong nay lam tsc --noEmit that bai.
    isSuperAdmin: false,
    email: 'user@example.com',
    roles: ['member'],
    permissions: [],
  };

  function createSocket(token?: string): Socket {
    return {
      id: 'socket-1',
      handshake: { auth: { token } },
      data: {},
      join: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    } as unknown as Socket;
  }

  function createGateway(options: { blacklisted?: boolean | Error; verifyError?: boolean } = {}) {
    const jwtService = {
      verify: options.verifyError
        ? jest.fn().mockImplementation(() => {
            throw new Error('token het han');
          })
        : jest.fn().mockReturnValue(PAYLOAD),
    } as unknown as JwtService;
    const configService = { get: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;
    const isUserBlacklisted =
      options.blacklisted instanceof Error
        ? jest.fn().mockRejectedValue(options.blacklisted)
        : jest.fn().mockResolvedValue(options.blacklisted ?? false);
    const redisService = { isUserBlacklisted } as unknown as RedisService;
    const gateway = new NotificationsGateway(jwtService, configService, redisService);
    return { gateway };
  }

  it('token hop le, khong blacklist: join dung room user:<id>, khong ngat ket noi', async () => {
    const { gateway } = createGateway();
    const socket = createSocket('valid.token');

    await gateway.handleConnection(socket);

    expect(socket.join).toHaveBeenCalledWith('user:user-1');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('ngat ket noi khi thieu token', async () => {
    const { gateway } = createGateway();
    const socket = createSocket(undefined);

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('ngat ket noi khi token khong hop le/het han', async () => {
    const { gateway } = createGateway({ verifyError: true });
    const socket = createSocket('bad.token');

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('ngat ket noi khi token hop le NHUNG tai khoan da bi blacklist (vua bi deactivate)', async () => {
    const { gateway } = createGateway({ blacklisted: true });
    const socket = createSocket('valid.token');

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('fail-open (van join room) khi Redis loi luc kiem tra blacklist', async () => {
    const { gateway } = createGateway({ blacklisted: new Error('Redis timeout') });
    const socket = createSocket('valid.token');

    await gateway.handleConnection(socket);

    expect(socket.join).toHaveBeenCalledWith('user:user-1');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });
});
