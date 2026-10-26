// 26/10/2026: read-model tai lieu theo pham vi du an - moi su kien ra dung 1 cau SQL idempotent,
// su kien khong lien quan/thieu truong bi bo qua, anh chup thay toan bo trong 1 transaction.
import { QueryFailedError } from 'typeorm';
import { DomainEvent, EVENT_TYPES } from '@app/common-dto';
import { isPermanentDataError, ProjectScopeService } from './project-scope.service';
import { ProjectRef } from '../entities/project-ref.entity';
import { ProjectMemberRef } from '../entities/project-member-ref.entity';

function event(eventType: string, payload: Record<string, unknown>): DomainEvent {
  return { eventId: 'e-1', eventType, occurredAt: '2026-10-26T03:00:00.000Z', organizationId: 'org-1', producer: 'x', payload };
}

function buildService() {
  const manager = { query: jest.fn().mockResolvedValue(undefined), insert: jest.fn().mockResolvedValue(undefined) };
  const dataSource = {
    query: jest.fn().mockResolvedValue(undefined),
    transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  return { service: new ProjectScopeService(dataSource as never), dataSource, manager };
}

describe('ProjectScopeService.applyEvent', () => {
  it('thanh vien: them (kem dam bao dong du an) / go theo khoa (projectId, userId)', async () => {
    const { service, dataSource } = buildService();
    await expect(service.applyEvent(event(EVENT_TYPES.PROJECT_MEMBER_ADDED, { projectId: 'p1', userId: 'u1' }))).resolves.toBe(true);
    expect(dataSource.query.mock.calls[0][0]).toContain('INSERT INTO project_member_refs');
    expect(dataSource.query.mock.calls[0][0]).toContain('ON CONFLICT DO NOTHING');
    expect(dataSource.query.mock.calls[0][1]).toEqual(['p1', 'u1', 'org-1']);

    await service.applyEvent(event(EVENT_TYPES.PROJECT_MEMBER_REMOVED, { projectId: 'p1', userId: 'u1' }));
    expect(dataSource.query.mock.calls[1]).toEqual(['DELETE FROM project_member_refs WHERE project_id = $1 AND user_id = $2', ['p1', 'u1']]);
  });

  // 26/10/2026: PROJECT_CREATED ghi them nguoi tao (createdByUserId, su kien cu: actorId); lead chi ghi de khi
  // su kien co truong leadUserId ($5), nguoi tao giu gia tri da biet neu su kien khong co (COALESCE).
  it('lead: PROJECT_LEAD_CHANGED va PROJECT_CREATED co leadUserId -> ghi de lead; PROJECT_CREATED cu (khong co truong) -> giu lead', async () => {
    const { service, dataSource } = buildService();
    await service.applyEvent(event(EVENT_TYPES.PROJECT_LEAD_CHANGED, { projectId: 'p1', leadUserId: null }));
    await service.applyEvent(event(EVENT_TYPES.PROJECT_CREATED, { projectId: 'p2', leadUserId: 'u9', createdByUserId: 'u-creator', actorId: 'u-creator' }));
    await service.applyEvent(event(EVENT_TYPES.PROJECT_CREATED, { projectId: 'p3', name: 'cu', actorId: 'u-old-creator' }));

    expect(dataSource.query.mock.calls[0][0]).toContain('DO UPDATE SET lead_user_id');
    expect(dataSource.query.mock.calls[0][1]).toEqual(['p1', 'org-1', null]);
    expect(dataSource.query.mock.calls[1][0]).toContain('COALESCE(EXCLUDED.created_by_user_id');
    expect(dataSource.query.mock.calls[1][1]).toEqual(['p2', 'org-1', 'u9', 'u-creator', true]);
    expect(dataSource.query.mock.calls[2][1]).toEqual(['p3', 'org-1', null, 'u-old-creator', false]);
  });

  it('xoa du an -> xoa thanh vien + dong du an trong 1 cau', async () => {
    const { service, dataSource } = buildService();
    await service.applyEvent(event(EVENT_TYPES.PROJECT_DELETED, { projectId: 'p1' }));
    expect(dataSource.query.mock.calls[0][0]).toContain('DELETE FROM project_member_refs');
    expect(dataSource.query.mock.calls[0][0]).toContain('DELETE FROM project_refs');
  });

  it('phong ban user: dang ky/doi phong ban -> upsert gia tri moi nhat; xoa user -> xoa dong', async () => {
    const { service, dataSource } = buildService();
    await service.applyEvent(event(EVENT_TYPES.USER_DEPARTMENT_CHANGED, { userId: 'u1', departmentId: 'd1' }));
    await service.applyEvent(event(EVENT_TYPES.USER_REGISTERED, { userId: 'u2', departmentId: null, email: 'a@b' }));
    await service.applyEvent(event(EVENT_TYPES.USER_DELETED, { userId: 'u1' }));
    expect(dataSource.query.mock.calls[0][1]).toEqual(['u1', 'org-1', 'd1']);
    expect(dataSource.query.mock.calls[1][1]).toEqual(['u2', 'org-1', null]);
    expect(dataSource.query.mock.calls[2]).toEqual(['DELETE FROM user_department_refs WHERE user_id = $1', ['u1']]);
  });

  it('su kien khong lien quan hoac thieu truong bat buoc -> bo qua, khong truy van', async () => {
    const { service, dataSource } = buildService();
    await expect(service.applyEvent(event(EVENT_TYPES.TASK_CREATED, { taskId: 't1' }))).resolves.toBe(false);
    await expect(service.applyEvent(event(EVENT_TYPES.PROJECT_MEMBER_ADDED, { projectId: 'p1' }))).resolves.toBe(false);
    await expect(service.applyEvent(event(EVENT_TYPES.PROJECT_LEAD_CHANGED, {}))).resolves.toBe(false);
    await expect(service.applyEvent(event(EVENT_TYPES.USER_DELETED, { userId: 5 }))).resolves.toBe(false);
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});

describe('ProjectScopeService.replaceProjectSnapshot', () => {
  it('xoa het roi chen lai du an + thanh vien trong 1 transaction', async () => {
    const { service, manager } = buildService();
    await service.replaceProjectSnapshot({
      takenAt: 'x',
      projects: [
        { projectId: 'p1', organizationId: 'org-1', leadUserId: 'u-lead', createdByUserId: 'u-creator', memberUserIds: ['u1', 'u2'] },
        // anh chup cua ban cu (khong co createdByUserId) -> null
        { projectId: 'p2', organizationId: 'org-1', leadUserId: null, memberUserIds: [] },
      ],
    });
    expect(manager.query.mock.calls.map((c) => c[0])).toEqual(['DELETE FROM project_member_refs', 'DELETE FROM project_refs']);
    expect(manager.insert).toHaveBeenCalledWith(ProjectRef, [
      { projectId: 'p1', organizationId: 'org-1', leadUserId: 'u-lead', createdByUserId: 'u-creator' },
      { projectId: 'p2', organizationId: 'org-1', leadUserId: null, createdByUserId: null },
    ]);
    expect(manager.insert).toHaveBeenCalledWith(ProjectMemberRef, [
      { projectId: 'p1', userId: 'u1', organizationId: 'org-1' },
      { projectId: 'p1', userId: 'u2', organizationId: 'org-1' },
    ]);
  });
});

describe('isPermanentDataError', () => {
  it('chi loi Postgres nhom 22/23 la vinh vien', () => {
    const pgError = (code: string) => new QueryFailedError('q', [], Object.assign(new Error('x'), { code }));
    expect(isPermanentDataError(pgError('22P02'))).toBe(true);
    expect(isPermanentDataError(pgError('23505'))).toBe(true);
    expect(isPermanentDataError(pgError('57P01'))).toBe(false);
    expect(isPermanentDataError(new Error('ECONNREFUSED'))).toBe(false);
  });
});
