// 26/10/2026: tai lieu theo pham vi du an - Project-Task Service phat su kien thanh vien/nguoi phu
// trach qua outbox va cung cap anh chup cho Document Service backfill read-model.
import { UnauthorizedException } from '@nestjs/common';
import { EVENT_TYPES } from '@app/common-dto';
import { ProjectsService } from './projects.service';
import { ProjectMembershipSnapshotService } from './project-membership-snapshot.service';
import { InternalProjectMembershipsController, isValidInternalSecret } from './internal-project-memberships.controller';

const organizationId = 'org-1';
const projectId = 'project-1';
const actorId = 'actor-1';

function buildService(project: Record<string, unknown>) {
  const projectRepo = {
    findOne: jest.fn().mockResolvedValue(project),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
  };
  const manager = {
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    create: jest.fn().mockImplementation((_entity, data) => data),
  };
  const dataSource = { transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)) };
  const outbox = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new ProjectsService(dataSource as never, projectRepo as never, {} as never, {} as never, outbox as never);
  return { service, projectRepo, manager, dataSource, outbox };
}

describe('ProjectsService.update - PROJECT_LEAD_CHANGED', () => {
  it('doi nguoi phu trach -> luu trong transaction + ghi 1 su kien kem lead cu/moi', async () => {
    const { service, manager, outbox, projectRepo } = buildService({ id: projectId, organizationId, leadUserId: 'lead-old' });
    await service.update(organizationId, projectId, { leadUserId: 'lead-new' }, actorId);

    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(projectRepo.save).not.toHaveBeenCalled();
    expect(outbox.record).toHaveBeenCalledWith(manager, {
      eventType: EVENT_TYPES.PROJECT_LEAD_CHANGED,
      organizationId,
      producer: 'project-task-service',
      payload: { projectId, leadUserId: 'lead-new', previousLeadUserId: 'lead-old', actorId },
    });
  });

  it('khong doi lead (chi doi ten, hoac gui lai dung lead cu) -> khong phat su kien', async () => {
    const { service, outbox, dataSource, projectRepo } = buildService({ id: projectId, organizationId, leadUserId: 'lead-1' });
    await service.update(organizationId, projectId, { name: 'Ten moi' }, actorId);
    await service.update(organizationId, projectId, { leadUserId: 'lead-1' }, actorId);

    expect(projectRepo.save).toHaveBeenCalledTimes(2);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
  });
});

describe('ProjectsService.create - PROJECT_CREATED mang leadUserId', () => {
  it('lead chon luc tao du an nam trong payload', async () => {
    const { service, outbox } = buildService({});
    await service.create(organizationId, actorId, { name: 'Du an A', leadUserId: 'lead-1' } as never);
    expect(outbox.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: EVENT_TYPES.PROJECT_CREATED,
        payload: expect.objectContaining({ leadUserId: 'lead-1', actorId }),
      }),
    );
  });
});

describe('ProjectMembershipSnapshotService', () => {
  it('gom thanh vien theo du an, du an khong co thanh vien -> mang rong', async () => {
    const repos: Record<string, { find: jest.Mock }> = {
      Project: {
        find: jest.fn().mockResolvedValue([
          { id: 'p1', organizationId: 'org-1', leadUserId: 'u-lead', createdByUserId: 'u-creator' },
          { id: 'p2', organizationId: 'org-2', leadUserId: null, createdByUserId: 'u-creator-2' },
        ]),
      },
      ProjectMember: {
        find: jest.fn().mockResolvedValue([
          { projectId: 'p1', userId: 'u1' },
          { projectId: 'p1', userId: 'u2' },
        ]),
      },
    };
    const dataSource = { getRepository: jest.fn((entity: { name: string }) => repos[entity.name]) };
    const result = await new ProjectMembershipSnapshotService(dataSource as never).snapshot();

    expect(result.projects).toEqual([
      // 26/10/2026: kem nguoi tao ("thuoc du an" = lead/thanh vien/nguoi tao) cho Document Service.
      { projectId: 'p1', organizationId: 'org-1', leadUserId: 'u-lead', createdByUserId: 'u-creator', memberUserIds: ['u1', 'u2'] },
      { projectId: 'p2', organizationId: 'org-2', leadUserId: null, createdByUserId: 'u-creator-2', memberUserIds: [] },
    ]);
    expect(Number.isNaN(Date.parse(result.takenAt))).toBe(false);
  });
});

describe('InternalProjectMembershipsController', () => {
  const snapshotService = { snapshot: jest.fn().mockResolvedValue({ takenAt: 'x', projects: [] }) };
  const controller = new InternalProjectMembershipsController(snapshotService as never);
  const original = process.env.INTERNAL_SHARED_SECRET;
  beforeAll(() => {
    process.env.INTERNAL_SHARED_SECRET = 'secret-123';
  });
  afterAll(() => {
    process.env.INTERNAL_SHARED_SECRET = original;
  });

  it('dung bi mat -> tra anh chup; thieu/sai bi mat -> 401', async () => {
    await expect(controller.snapshot('secret-123')).resolves.toEqual({ takenAt: 'x', projects: [] });
    expect(() => controller.snapshot(undefined)).toThrow(UnauthorizedException);
    expect(() => controller.snapshot('secret-12')).toThrow(UnauthorizedException);
  });

  it('isValidInternalSecret: khac do dai/rong -> false', () => {
    expect(isValidInternalSecret('abc', 'abc')).toBe(true);
    expect(isValidInternalSecret('abcd', 'abc')).toBe(false);
    expect(isValidInternalSecret('', 'abc')).toBe(false);
  });
});
