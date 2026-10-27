import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import type { DataSource } from 'typeorm';
import { PERMISSIONS, type JwtAccessPayload } from '@app/common-dto';
import type { RedisService } from '../redis/redis.service';
import { AnalyticsGateway } from './analytics.gateway';

/**
 * 25/08/2026: unit test moi cho 2 fix ra soat bao mat - handleConnection() truoc day (1) chi
 * verify chu ky JWT, KHONG kiem tra blacklist (khac REST qua Gateway, da kiem tra tu 21/07/2026) -
 * 1 tai khoan vua bi deactivate van mo duoc ket noi WebSocket moi va nhan du lieu hoat dong
 * real-time cua to chuc toi khi access token het han tu nhien (toi da 15 phut); va (2) chi XAC
 * THUC (verify JWT), khong UY QUYEN (kiem tra quyen analytics:view nhu REST da lam qua
 * @RequirePermissions) - 1 nhan vien khong co quyen xem bao cao van tho dong nhan feed hoat dong.
 * File nay truoc do KHONG co spec nao ca.
 */
describe('AnalyticsGateway.handleConnection', () => {
  const PAYLOAD: JwtAccessPayload = {
    sub: 'user-1',
    organizationId: 'org-1',
    departmentId: null,
    // 16/09/2026: bo sung isSuperAdmin - truong bat buoc tu JwtAccessPayload sau tinh nang moi
    // "Super Admin" (xem auth-context.interface.ts), thieu truong nay lam tsc --noEmit that bai.
    isSuperAdmin: false,
    email: 'user@example.com',
    roles: ['manager'],
    permissions: [PERMISSIONS.ANALYTICS_VIEW],
  };

  function createSocket(token?: string): Socket {
    return {
      id: 'socket-1',
      handshake: { auth: { token } },
      join: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    } as unknown as Socket;
  }

  function createGateway(
    options: { blacklisted?: boolean | Error; verifyError?: boolean; payload?: JwtAccessPayload } = {},
  ) {
    const jwtService = {
      verifyAsync: options.verifyError
        ? jest.fn().mockRejectedValue(new Error('token het han'))
        : jest.fn().mockResolvedValue(options.payload ?? PAYLOAD),
    } as unknown as JwtService;
    const configService = { get: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;
    const isUserBlacklisted =
      options.blacklisted instanceof Error
        ? jest.fn().mockRejectedValue(options.blacklisted)
        : jest.fn().mockResolvedValue(options.blacklisted ?? false);
    const redisService = { isUserBlacklisted } as unknown as RedisService;
    // 26/10/2026: dataSource tra phong ban Manager dang phu trach (dim_department_manager) - xem resolveRooms().
    const dataSource = { query: jest.fn().mockResolvedValue([{ department_id: 'dept-2' }]) } as unknown as DataSource;
    const gateway = new AnalyticsGateway(jwtService, configService, redisService, dataSource);
    return { gateway };
  }

  // 26/10/2026: chia phong theo pham vi - chi Org Admin con vao phong toan to chuc.
  const ADMIN_PAYLOAD: JwtAccessPayload = { ...PAYLOAD, roles: ['Org Admin'], permissions: [PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.USER_MANAGE] };

  it('Org Admin hop le, khong blacklist: join dung room org:<id>, khong ngat ket noi', async () => {
    const { gateway } = createGateway({ payload: ADMIN_PAYLOAD });
    const socket = createSocket('valid.token');

    await gateway.handleConnection(socket);

    expect(socket.join).toHaveBeenCalledWith(['org:org-1']);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('Manager: KHONG vao phong toan to chuc - chi phong user:<minh> + dept:<phong ban JWT/phong ban phu trach>', async () => {
    const { gateway } = createGateway({ payload: { ...PAYLOAD, departmentId: 'dept-1' } });
    const socket = createSocket('valid.token');

    await gateway.handleConnection(socket);

    expect(socket.join).toHaveBeenCalledWith(['user:user-1', 'dept:dept-1', 'dept:dept-2']);
  });

  it('emitActivity: day toi phong to chuc + chinh nguoi thuc hien + phong ban cua nguoi thuc hien (tra dim_user)', async () => {
    const { gateway } = createGateway();
    const rooms: string[] = [];
    const emit = jest.fn();
    const operator: { to: jest.Mock; emit: jest.Mock } = { to: jest.fn(), emit };
    operator.to.mockImplementation((room: string) => {
      rooms.push(room);
      return operator;
    });
    (gateway as unknown as { server: unknown }).server = operator;

    gateway.emitActivity('org-1', { eventId: 'e1', eventType: 'task.created', occurredAt: 'x', actorId: 'actor-1' });
    await new Promise((resolve) => setImmediate(resolve));

    expect(rooms).toEqual(['org:org-1', 'user:actor-1', 'dept:dept-2']);
    expect(emit).toHaveBeenCalledWith('analytics:activity', expect.objectContaining({ eventId: 'e1' }));
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
    const { gateway } = createGateway({ blacklisted: new Error('Redis timeout'), payload: ADMIN_PAYLOAD });
    const socket = createSocket('valid.token');

    await gateway.handleConnection(socket);

    expect(socket.join).toHaveBeenCalledWith(['org:org-1']);
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('ngat ket noi khi token hop le, khong blacklist, NHUNG thieu quyen analytics:view (vd Employee mac dinh)', async () => {
    const { gateway } = createGateway({ payload: { ...PAYLOAD, roles: ['employee'], permissions: [] } });
    const socket = createSocket('valid.token');

    await gateway.handleConnection(socket);

    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
  });
});
