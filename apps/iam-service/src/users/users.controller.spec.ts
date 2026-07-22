import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS_KEY } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * 22/07/2026: unit test toi thieu cho RBAC cua UsersController - review phat hien GET /users va
 * GET /users/:id truoc do KHONG co bat ky guard nao (moi nhan vien da xac thuc, du khac phong
 * ban/vai tro, deu liet ke duoc toan bo thanh vien va doc duoc ho so day du cua BAT KY dong
 * nghiep nao) ma KHONG co test nao bao ve dieu do (loi MAJOR, review 22/07/2026).
 * - findAll(): review ban dau yeu cau gan @RequirePermissions(USER_MANAGE), nhung sau khi kiem
 *   tra frontend (xem chu thich chi tiet tai findAll() trong users.controller.ts) phat hien GET
 *   /users la nguon du lieu nen tang cho hooks/useOrgUsers.ts, dung o Dashboard/AssigneePicker/
 *   TaskCard/ShareModal/tim kiem tong hop - toan man hinh KHONG-phai-admin ma MOI nhan vien deu
 *   vao ngay sau dang nhap. Gan USER_MANAGE se 403 hang loat cho Manager/Employee (khong co
 *   permission nay) - mot regression nghiem trong hon loi dang sua. Quyet dinh CO CHU DICH: de mo,
 *   test duoi day xac nhan KHONG co metadata permission nao duoc gan (chot lai quyet dinh nay,
 *   tranh ai do vo tinh gan lai USER_MANAGE trong tuong lai ma khong doc chu thich).
 * - findOne(): PermissionsGuard KHONG the bao ve endpoint nay (khong dung @RequirePermissions vi
 *   can dieu kien OR "tu xem chinh minh HOAC co quyen user:manage" - xem chu thich trong
 *   users.controller.ts) nen test truc tiep logic thu cong trong handler.
 */
describe('UsersController - RBAC (Fix 5, review 22/07/2026)', () => {
  it('GET /users (findAll) CO CHU DICH khong gan permission nao (xem chu thich findAll() - khac review ban dau)', () => {
    const required = Reflect.getMetadata(PERMISSIONS_KEY, UsersController.prototype.findAll);
    expect(required).toBeUndefined();
  });

  describe('GET /users/:id (findOne) - tu xem chinh minh HOAC co quyen user:manage', () => {
    let controller: UsersController;
    let serviceMock: { findById: jest.Mock };

    beforeEach(() => {
      serviceMock = { findById: jest.fn().mockResolvedValue({ id: 'user-1', fullName: 'Nguyen Van A' }) };
      controller = new UsersController(serviceMock as unknown as UsersService);
    });

    it('cho phep tu xem chinh minh (id === callerId) DU KHONG co quyen user:manage', async () => {
      const result = await controller.findOne('org-1', 'user-1', [], 'user-1');
      expect(result).toEqual({ id: 'user-1', fullName: 'Nguyen Van A' });
      expect(serviceMock.findById).toHaveBeenCalledWith('org-1', 'user-1');
    });

    it('tu choi (ForbiddenException, KHONG goi service) khi xem nguoi khac va khong co quyen user:manage', () => {
      // findOne() KHONG phai async - nem ForbiddenException dong bo (khong tra ve Promise bi
      // reject) nen phai dung expect(() => ...).toThrow() thay vi .rejects.toThrow().
      expect(() => controller.findOne('org-1', 'user-1', [], 'user-2')).toThrow(ForbiddenException);
      expect(serviceMock.findById).not.toHaveBeenCalled();
    });

    it('cho phep xem nguoi khac khi nguoi goi co quyen user:manage', async () => {
      const result = await controller.findOne('org-1', 'user-1', [PERMISSIONS.USER_MANAGE], 'user-2');
      expect(result).toEqual({ id: 'user-1', fullName: 'Nguyen Van A' });
      expect(serviceMock.findById).toHaveBeenCalledWith('org-1', 'user-2');
    });
  });
});
