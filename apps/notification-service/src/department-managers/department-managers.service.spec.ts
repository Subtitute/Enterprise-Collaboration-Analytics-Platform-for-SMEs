import { Model } from 'mongoose';
import { DepartmentManagersService } from './department-managers.service';
import { DepartmentManagerDocument } from './schemas/department-manager.schema';

/**
 * 23/09/2026: unit test cho DepartmentManagersService - read-model cuc bo "phong ban nao dang do
 * ai phu trach" (xem chu thich tai schemas/department-manager.schema.ts), mirror pattern mock
 * Model cua org-members.service.spec.ts.
 */
describe('DepartmentManagersService', () => {
  let service: DepartmentManagersService;
  let modelMock: { updateOne: jest.Mock; find: jest.Mock };

  beforeEach(() => {
    modelMock = {
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
      find: jest.fn(),
    };
    service = new DepartmentManagersService(modelMock as unknown as Model<DepartmentManagerDocument>);
  });

  describe('setManager', () => {
    it('upsert managerId theo cap (organizationId, departmentId)', async () => {
      await service.setManager('org-1', 'dept-1', 'user-1');

      expect(modelMock.updateOne).toHaveBeenCalledWith(
        { organizationId: 'org-1', departmentId: 'dept-1' },
        { $set: { managerId: 'user-1' } },
        { upsert: true },
      );
    });

    it('ghi managerId = null khi phong ban vua bi go nguoi phu trach', async () => {
      await service.setManager('org-1', 'dept-1', null);

      expect(modelMock.updateOne).toHaveBeenCalledWith(
        { organizationId: 'org-1', departmentId: 'dept-1' },
        { $set: { managerId: null } },
        { upsert: true },
      );
    });
  });

  describe('listDepartmentIdsManagedBy', () => {
    it('tra ve danh sach departmentId ma nguoi nay dang la nguoi phu trach', async () => {
      const selectMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ departmentId: 'dept-1' }, { departmentId: 'dept-2' }]),
      });
      modelMock.find.mockReturnValue({ select: selectMock });

      const result = await service.listDepartmentIdsManagedBy('org-1', 'user-1');

      expect(modelMock.find).toHaveBeenCalledWith({ organizationId: 'org-1', managerId: 'user-1' });
      expect(result).toEqual(['dept-1', 'dept-2']);
    });

    it('tra ve mang rong khi khong phu trach phong ban nao', async () => {
      const selectMock = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      modelMock.find.mockReturnValue({ select: selectMock });

      const result = await service.listDepartmentIdsManagedBy('org-1', 'user-1');

      expect(result).toEqual([]);
    });
  });
});
