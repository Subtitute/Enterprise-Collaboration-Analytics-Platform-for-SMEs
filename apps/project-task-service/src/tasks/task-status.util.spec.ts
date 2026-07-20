import { TaskStatus } from '@app/common-dto';
import { isValidTaskStatusTransition } from './task-status.util';

/**
 * Unit test cho logic kiem tra chuyen trang thai Task (Kanban board) -
 * Technical_Spec.md muc 3.3. Tuong tu cach IAM test parseDurationMs/PermissionsGuard
 * nhu cac ham thuan (pure function), khong can boot NestJS module hay DB that.
 */
describe('isValidTaskStatusTransition', () => {
  it('cho phep TODO -> DOING', () => {
    expect(isValidTaskStatusTransition(TaskStatus.TODO, TaskStatus.DOING)).toBe(true);
  });

  it('cho phep DOING -> DONE', () => {
    expect(isValidTaskStatusTransition(TaskStatus.DOING, TaskStatus.DONE)).toBe(true);
  });

  it('cho phep DOING -> TODO (lui trang thai)', () => {
    expect(isValidTaskStatusTransition(TaskStatus.DOING, TaskStatus.TODO)).toBe(true);
  });

  it('cho phep DONE -> DOING (mo lai cong viec)', () => {
    expect(isValidTaskStatusTransition(TaskStatus.DONE, TaskStatus.DOING)).toBe(true);
  });

  it('tu choi TODO -> DONE (bo qua cot DOING)', () => {
    expect(isValidTaskStatusTransition(TaskStatus.TODO, TaskStatus.DONE)).toBe(false);
  });

  it('tu choi DONE -> TODO (phai qua DOING truoc)', () => {
    expect(isValidTaskStatusTransition(TaskStatus.DONE, TaskStatus.TODO)).toBe(false);
  });

  it('tu choi chuyen ve chinh trang thai hien tai (no-op khong hop le)', () => {
    expect(isValidTaskStatusTransition(TaskStatus.TODO, TaskStatus.TODO)).toBe(false);
    expect(isValidTaskStatusTransition(TaskStatus.DOING, TaskStatus.DOING)).toBe(false);
    expect(isValidTaskStatusTransition(TaskStatus.DONE, TaskStatus.DONE)).toBe(false);
  });
});
