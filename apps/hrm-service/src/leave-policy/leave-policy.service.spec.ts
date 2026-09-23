import { QueryFailedError } from 'typeorm';
import { LeavePolicyService } from './leave-policy.service';

/**
 * 22/09/2026: unit test cho LeavePolicyService - mirror phong cach mock thu cong cua
 * TasksService.assign() (apps/project-task-service) cho nhanh idempotent bat QueryFailedError 23505.
 */
describe('LeavePolicyService', () => {
  const organizationId = 'org-1';

  function createService(policyRepoMock: { findOne: jest.Mock; save?: jest.Mock; create?: jest.Mock }) {
    const repoMock = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve({ id: 'policy-1', ...(entity as object) })),
      ...policyRepoMock,
    };
    return { service: new LeavePolicyService(repoMock as any), repoMock };
  }

  describe('getOrCreate', () => {
    it('tra ve chinh sach da co san neu to chuc da tung cau hinh', async () => {
      const existing = { id: 'policy-1', organizationId, baseDaysPerYear: 14, seniorityYearsPerBonusDay: 3 };
      const { service, repoMock } = createService({ findOne: jest.fn().mockResolvedValue(existing) });

      const result = await service.getOrCreate(organizationId);

      expect(result).toBe(existing);
      expect(repoMock.save).not.toHaveBeenCalled();
    });

    it('tu tao chinh sach mac dinh (12 ngay/nam, +1 ngay/5 nam) neu to chuc chua tung cau hinh', async () => {
      const { service, repoMock } = createService({ findOne: jest.fn().mockResolvedValue(undefined) });

      const result = await service.getOrCreate(organizationId);

      expect(repoMock.create).toHaveBeenCalledWith({ organizationId });
      expect(result).toMatchObject({ organizationId });
    });

    it('idempotent: doc lai ban ghi da duoc tao boi request thang cuoc khi 2 request dau tien dam vao unique_violation (23505)', async () => {
      const race = { id: 'policy-1', organizationId, baseDaysPerYear: 12, seniorityYearsPerBonusDay: 5 };
      const findOne = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(race);
      const error = new QueryFailedError('INSERT', [], new Error('duplicate key'));
      (error as any).driverError = { code: '23505' };
      const save = jest.fn().mockRejectedValue(error);
      const { service } = createService({ findOne, save });

      const result = await service.getOrCreate(organizationId);

      expect(result).toBe(race);
      expect(findOne).toHaveBeenCalledTimes(2);
    });

    it('nem lai loi neu la loi DB khac, khong phai vi pham unique constraint 23505', async () => {
      const otherError = new Error('connection lost');
      const findOne = jest.fn().mockResolvedValue(undefined);
      const save = jest.fn().mockRejectedValue(otherError);
      const { service } = createService({ findOne, save });

      await expect(service.getOrCreate(organizationId)).rejects.toThrow('connection lost');
    });
  });

  describe('update', () => {
    it('chi cap nhat field duoc truyen, giu nguyen field con lai', async () => {
      const existing = { id: 'policy-1', organizationId, baseDaysPerYear: 12, seniorityYearsPerBonusDay: 5 };
      const { service, repoMock } = createService({ findOne: jest.fn().mockResolvedValue(existing) });

      const result = await service.update(organizationId, { baseDaysPerYear: 15 });

      expect(result).toMatchObject({ baseDaysPerYear: 15, seniorityYearsPerBonusDay: 5 });
      expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({ baseDaysPerYear: 15 }));
    });
  });
});
