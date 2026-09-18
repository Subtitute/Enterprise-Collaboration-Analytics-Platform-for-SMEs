import { NotFoundException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';

/**
 * 17/09/2026: unit test moi cho DepartmentsService - truoc day KHONG ton tai bat ky test nao cho
 * service nay. Them cung luc voi tinh nang Department.managerId (nguoi phu trach phong ban) de
 * bao ve 2 nhanh quan trong:
 *   1) create()/update() luu dung managerId khi id do la 1 user hop le trong CUNG to chuc.
 *   2) update() tu choi (404 USER_NOT_FOUND) khi managerId khong ung voi user nao trong DUNG to
 *      chuc - cung 1 loai lo hong "gan xuyen to chuc" ma UsersService.update() da chan cho
 *      departmentId (xem chu thich trong users.service.ts).
 */
describe('DepartmentsService', () => {
  const ORG_ID = 'org-1';
  const OTHER_ORG_ID = 'org-2';
  const DEPARTMENT_ID = 'dept-1';
  const MANAGER_ID = 'user-1';

  let departmentRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; remove: jest.Mock };
  let userRepo: { findOne: jest.Mock };
  let service: DepartmentsService;

  beforeEach(() => {
    departmentRepo = {
      findOne: jest.fn(),
      create: jest.fn((input) => input),
      save: jest.fn(async (entity) => entity),
      remove: jest.fn(),
    };
    userRepo = { findOne: jest.fn() };
    service = new DepartmentsService(departmentRepo as any, userRepo as any);
  });

  describe('create()', () => {
    it('tao phong ban thanh cong va luu dung managerId khi id do la user hop le trong cung to chuc', async () => {
      userRepo.findOne.mockResolvedValue({ id: MANAGER_ID, organizationId: ORG_ID });

      const result = await service.create(ORG_ID, { name: 'Ky thuat', managerId: MANAGER_ID });

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: MANAGER_ID, organizationId: ORG_ID },
      });
      expect(result).toEqual(
        expect.objectContaining({ organizationId: ORG_ID, name: 'Ky thuat', managerId: MANAGER_ID }),
      );
    });

    it('tao phong ban thanh cong voi managerId = null khi khong truyen truong nay', async () => {
      const result = await service.create(ORG_ID, { name: 'Ky thuat' });

      expect(userRepo.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ organizationId: ORG_ID, name: 'Ky thuat', managerId: null }),
      );
    });

    it('tu choi (404) khi tao phong ban voi managerId khong thuoc to chuc dang thao tac', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(ORG_ID, { name: 'Ky thuat', managerId: MANAGER_ID }),
      ).rejects.toThrow(NotFoundException);
      expect(departmentRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('cap nhat thanh cong managerId khi id do la user hop le trong cung to chuc', async () => {
      const department = { id: DEPARTMENT_ID, organizationId: ORG_ID, name: 'Ky thuat', managerId: null };
      departmentRepo.findOne.mockResolvedValue(department);
      userRepo.findOne.mockResolvedValue({ id: MANAGER_ID, organizationId: ORG_ID });

      const result = await service.update(ORG_ID, DEPARTMENT_ID, { managerId: MANAGER_ID });

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: MANAGER_ID, organizationId: ORG_ID },
      });
      expect(result.managerId).toBe(MANAGER_ID);
    });

    it('tu choi (404 USER_NOT_FOUND) khi cap nhat managerId khong ton tai/thuoc to chuc khac', async () => {
      const department = { id: DEPARTMENT_ID, organizationId: ORG_ID, name: 'Ky thuat', managerId: null };
      departmentRepo.findOne.mockResolvedValue(department);
      // managerId thuoc mot user co that nhung o TO CHUC KHAC - userRepo.findOne loc theo
      // organizationId nen tra ve null giong het truong hop id khong ton tai.
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(ORG_ID, DEPARTMENT_ID, { managerId: MANAGER_ID }),
      ).rejects.toThrow(NotFoundException);
      expect(departmentRepo.save).not.toHaveBeenCalled();
      expect(department.managerId).toBeNull();
    });

    it('tu choi (404) khi phong ban khong ton tai/thuoc to chuc khac, KHONG tra cuu managerId', async () => {
      departmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(OTHER_ORG_ID, DEPARTMENT_ID, { managerId: MANAGER_ID }),
      ).rejects.toThrow(NotFoundException);
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('khong dung toi userRepo khi request khong dong truong managerId', async () => {
      const department = { id: DEPARTMENT_ID, organizationId: ORG_ID, name: 'Ky thuat', managerId: MANAGER_ID };
      departmentRepo.findOne.mockResolvedValue(department);

      const result = await service.update(ORG_ID, DEPARTMENT_ID, { name: 'Cong nghe' });

      expect(userRepo.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ name: 'Cong nghe', managerId: MANAGER_ID }));
    });
  });
});
