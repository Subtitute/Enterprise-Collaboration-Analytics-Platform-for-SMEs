import { Model } from 'mongoose';
import { OrgMembersService } from './org-members.service';
import { OrgMemberDocument } from './schemas/org-member.schema';

/**
 * 17/09/2026: unit test cho OrgMembersService - read-model cuc bo danh sach thanh vien active
 * (xem chu thich tai schemas/org-member.schema.ts), mirror pattern mock Model cua
 * notifications.service.spec.ts.
 */
describe('OrgMembersService', () => {
  let service: OrgMembersService;
  let modelMock: { updateOne: jest.Mock; find: jest.Mock };

  beforeEach(() => {
    modelMock = {
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
      find: jest.fn(),
    };
    service = new OrgMembersService(modelMock as unknown as Model<OrgMemberDocument>);
  });

  describe('markActive', () => {
    it('upsert isActive=true theo cap (organizationId, userId)', async () => {
      await service.markActive('org-1', 'user-1');

      expect(modelMock.updateOne).toHaveBeenCalledWith(
        { organizationId: 'org-1', userId: 'user-1' },
        { $set: { isActive: true } },
        { upsert: true },
      );
    });

    it('ghi kem departmentId khi tham so nay duoc truyen (USER_REGISTERED co san departmentId)', async () => {
      await service.markActive('org-1', 'user-1', 'dept-1');

      expect(modelMock.updateOne).toHaveBeenCalledWith(
        { organizationId: 'org-1', userId: 'user-1' },
        { $set: { isActive: true, departmentId: 'dept-1' } },
        { upsert: true },
      );
    });

    it('ghi departmentId = null khi user dang KHONG thuoc phong ban nao (khac voi khong truyen tham so)', async () => {
      await service.markActive('org-1', 'user-1', null);

      expect(modelMock.updateOne).toHaveBeenCalledWith(
        { organizationId: 'org-1', userId: 'user-1' },
        { $set: { isActive: true, departmentId: null } },
        { upsert: true },
      );
    });
  });

  describe('setDepartment', () => {
    it('upsert departmentId theo cap (organizationId, userId)', async () => {
      await service.setDepartment('org-1', 'user-1', 'dept-2');

      expect(modelMock.updateOne).toHaveBeenCalledWith(
        { organizationId: 'org-1', userId: 'user-1' },
        { $set: { departmentId: 'dept-2' } },
        { upsert: true },
      );
    });
  });

  describe('markInactive', () => {
    it('upsert isActive=false theo cap (organizationId, userId)', async () => {
      await service.markInactive('org-1', 'user-1');

      expect(modelMock.updateOne).toHaveBeenCalledWith(
        { organizationId: 'org-1', userId: 'user-1' },
        { $set: { isActive: false } },
        { upsert: true },
      );
    });
  });

  describe('listActiveUserIds', () => {
    it('tra ve danh sach userId, chi loc thanh vien active cua dung to chuc', async () => {
      const selectMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]),
      });
      modelMock.find.mockReturnValue({ select: selectMock });

      const result = await service.listActiveUserIds('org-1');

      expect(modelMock.find).toHaveBeenCalledWith({ organizationId: 'org-1', isActive: true });
      expect(result).toEqual(['user-1', 'user-2']);
    });

    it('tra ve mang rong khi khong co thanh vien active nao', async () => {
      const selectMock = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      modelMock.find.mockReturnValue({ select: selectMock });

      const result = await service.listActiveUserIds('org-1');

      expect(result).toEqual([]);
    });
  });

  describe('listActiveUserIdsInDepartments', () => {
    it('tra ve danh sach userId active thuoc 1 trong cac phong ban duoc truyen', async () => {
      const selectMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]),
      });
      modelMock.find.mockReturnValue({ select: selectMock });

      const result = await service.listActiveUserIdsInDepartments('org-1', ['dept-1', 'dept-2']);

      expect(modelMock.find).toHaveBeenCalledWith({
        organizationId: 'org-1',
        isActive: true,
        departmentId: { $in: ['dept-1', 'dept-2'] },
      });
      expect(result).toEqual(['user-1', 'user-2']);
    });

    it('tra ve mang rong ma KHONG truy van Mongo khi danh sach phong ban rong', async () => {
      const result = await service.listActiveUserIdsInDepartments('org-1', []);

      expect(modelMock.find).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});
