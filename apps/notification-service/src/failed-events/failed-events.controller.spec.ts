import { PERMISSIONS_KEY } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { FailedEventsController } from './failed-events.controller';

/**
 * 28/07/2026: unit test toi thieu cho RBAC cua FailedEventsController (Technical_Spec.md muc 14
 * - nang cap Dead Letter Queue). MAU THAM CHIEU: apps/iam-service/src/roles/roles.controller.spec.ts
 * (kiem tra THANG metadata @RequirePermissions da duoc gan tren handler, khong goi qua
 * HTTP/Guard thuc te - PermissionsGuard da co unit test rieng trong packages/common-guard).
 */
describe('FailedEventsController - RBAC', () => {
  it('GET /failed-events (findAll) yeu cau permission system:manage', () => {
    const required = Reflect.getMetadata(PERMISSIONS_KEY, FailedEventsController.prototype.findAll);
    expect(required).toEqual([PERMISSIONS.SYSTEM_MANAGE]);
  });
});
