import { EVENT_TYPES, PERMISSIONS } from '@app/common-dto';
import { applyDirectoryEvent, handleDirectoryMessage, resolveScopeUserIds } from './user-directory';

/** 26/10/2026: read-model dim_user (user -> phong ban) va pham vi xem 3 cap - xem user-directory.ts. */
describe('user-directory', () => {
  const org = '11111111-1111-4111-8111-111111111111';
  const user = '22222222-2222-4222-8222-222222222222';
  const dept = '33333333-3333-4333-8333-333333333333';

  function makeDataSource(rows: Array<{ userId: string }> = []) {
    const repo = { upsert: jest.fn(), delete: jest.fn(), find: jest.fn().mockResolvedValue(rows) };
    return { repo, dataSource: { getRepository: jest.fn().mockReturnValue(repo) } as any };
  }

  it('USER_REGISTERED/USER_DEPARTMENT_CHANGED -> upsert gia tri moi nhat theo userId', async () => {
    const { repo, dataSource } = makeDataSource();
    for (const eventType of [EVENT_TYPES.USER_REGISTERED, EVENT_TYPES.USER_DEPARTMENT_CHANGED]) {
      expect(await applyDirectoryEvent(dataSource, { eventType, organizationId: org, payload: { userId: user, departmentId: dept } } as any)).toBe(true);
    }
    expect(repo.upsert).toHaveBeenCalledTimes(2);
    expect(repo.upsert).toHaveBeenCalledWith(expect.objectContaining({ userId: user, organizationId: org, departmentId: dept }), ['userId']);
  });

  it('departmentId null/khong hop le -> luu null (user khong thuoc phong ban nao)', async () => {
    const { repo, dataSource } = makeDataSource();
    await applyDirectoryEvent(dataSource, { eventType: EVENT_TYPES.USER_DEPARTMENT_CHANGED, organizationId: org, payload: { userId: user, departmentId: 'x' } } as any);
    expect(repo.upsert).toHaveBeenCalledWith(expect.objectContaining({ departmentId: null }), ['userId']);
  });

  it('USER_DELETED -> xoa dong cua user', async () => {
    const { repo, dataSource } = makeDataSource();
    expect(await applyDirectoryEvent(dataSource, { eventType: EVENT_TYPES.USER_DELETED, organizationId: org, payload: { userId: user } } as any)).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith({ userId: user, organizationId: org });
  });

  it('bo qua su kien khac hoac thieu userId/organizationId hop le', async () => {
    const { repo, dataSource } = makeDataSource();
    expect(await applyDirectoryEvent(dataSource, { eventType: EVENT_TYPES.CUSTOMER_CREATED, organizationId: org, payload: { userId: user } } as any)).toBe(false);
    expect(await applyDirectoryEvent(dataSource, { eventType: EVENT_TYPES.USER_REGISTERED, organizationId: org, payload: { userId: 'abc' } } as any)).toBe(false);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('handleDirectoryMessage: message rong/JSON hong bi bo qua, khong nem loi', async () => {
    const { dataSource } = makeDataSource();
    expect(await handleDirectoryMessage(dataSource, null)).toBe(false);
    expect(await handleDirectoryMessage(dataSource, Buffer.from('{khong-phai-json'))).toBe(false);
    const ok = Buffer.from(JSON.stringify({ eventType: EVENT_TYPES.USER_DELETED, organizationId: org, payload: { userId: user } }));
    expect(await handleDirectoryMessage(dataSource, ok)).toBe(true);
  });

  it('resolveScopeUserIds: Org Admin -> null, Employee -> [chinh minh], Manager -> chinh minh + thanh vien phong ban', async () => {
    const { repo, dataSource } = makeDataSource([{ userId: 'member-1' }, { userId: user }]);
    expect(await resolveScopeUserIds(dataSource, org, user, [PERMISSIONS.USER_MANAGE], PERMISSIONS.CUSTOMER_CREATE, null)).toBeNull();
    expect(await resolveScopeUserIds(dataSource, org, user, [PERMISSIONS.CUSTOMER_VIEW], PERMISSIONS.CUSTOMER_CREATE, dept)).toEqual([user]);
    expect(await resolveScopeUserIds(dataSource, org, user, [PERMISSIONS.CUSTOMER_CREATE], PERMISSIONS.CUSTOMER_CREATE, dept)).toEqual([user, 'member-1']);
    expect(repo.find).toHaveBeenCalledWith({ where: { organizationId: org, departmentId: dept }, select: ['userId'] });
  });
});
