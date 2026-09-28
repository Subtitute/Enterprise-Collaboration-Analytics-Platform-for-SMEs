import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import type { JwtAccessPayload } from '@app/common-dto';
import type { RedisService } from '../redis/redis.service';
import type { ParticipantsService } from '../participants/participants.service';
import { MessagingGateway } from './messaging.gateway';

/** Mirror apps/notification-service/src/realtime/notifications.gateway.spec.ts, cong them cac test
 * rieng cua joinConversation/leaveConversation (kiem tra thanh vien truoc khi join room). */
describe('MessagingGateway.handleConnection', () => {
  const PAYLOAD: JwtAccessPayload = {
    sub: 'user-1',
    organizationId: 'org-1',
    departmentId: null,
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
      leave: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    } as unknown as Socket;
  }

  function createGateway(options: {
    blacklisted?: boolean | Error;
    verifyError?: boolean;
    isParticipant?: boolean;
  } = {}) {
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
    const participantsService = {
      isParticipant: jest.fn().mockResolvedValue(options.isParticipant ?? true),
    } as unknown as ParticipantsService;
    const gateway = new MessagingGateway(jwtService, configService, redisService, participantsService);
    return { gateway, participantsService };
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

  it('ngat ket noi khi token hop le NHUNG tai khoan da bi blacklist', async () => {
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

  describe('joinConversation', () => {
    it('join room conversation:<id> neu la thanh vien', async () => {
      const { gateway } = createGateway({ isParticipant: true });
      const socket = createSocket();
      socket.data.userId = 'user-1';

      await gateway.handleJoinConversation(socket, { conversationId: 'conv-1' });

      expect(socket.join).toHaveBeenCalledWith('conversation:conv-1');
    });

    it('KHONG join room va KHONG ngat ket noi neu khong phai thanh vien', async () => {
      const { gateway } = createGateway({ isParticipant: false });
      const socket = createSocket();
      socket.data.userId = 'user-1';

      await gateway.handleJoinConversation(socket, { conversationId: 'conv-1' });

      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('bo qua neu thieu conversationId hoac socket chua xac thuc (khong co userId)', async () => {
      const { gateway, participantsService } = createGateway();
      const socket = createSocket();

      await gateway.handleJoinConversation(socket, {});

      expect(participantsService.isParticipant).not.toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  describe('leaveConversation', () => {
    it('leave room conversation:<id>', () => {
      const { gateway } = createGateway();
      const socket = createSocket();

      gateway.handleLeaveConversation(socket, { conversationId: 'conv-1' });

      expect(socket.leave).toHaveBeenCalledWith('conversation:conv-1');
    });
  });

  describe('emit helpers', () => {
    it('emitNewMessage day toi room cuoc tro chuyen VA toi room tung thanh vien', () => {
      const { gateway } = createGateway();
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      (gateway as any).server = { to };

      gateway.emitNewMessage('conv-1', { id: 'msg-1' }, ['user-1', 'user-2']);

      expect(to).toHaveBeenCalledWith('conversation:conv-1');
      expect(to).toHaveBeenCalledWith('user:user-1');
      expect(to).toHaveBeenCalledWith('user:user-2');
      expect(emit).toHaveBeenCalledWith('message:new', { conversationId: 'conv-1', message: { id: 'msg-1' } });
    });

    it('emitNewConversation day toi room tung thanh vien ban dau', () => {
      const { gateway } = createGateway();
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      (gateway as any).server = { to };

      gateway.emitNewConversation({ id: 'conv-1' }, ['user-1', 'user-2']);

      expect(to).toHaveBeenCalledWith('user:user-1');
      expect(to).toHaveBeenCalledWith('user:user-2');
      expect(emit).toHaveBeenCalledWith('conversation:new', { conversation: { id: 'conv-1' } });
    });
  });
});
