import { TaskStatus, ProjectStatus, TASK_STATUS_TRANSITIONS } from './task-status.enum';
import { DealStage, DEAL_STAGE_TRANSITIONS } from './deal-stage.enum';
import { LeaveRequestStatus } from './leave-request-status.enum';
import { CalendarEventType } from './calendar-event-type.enum';
import { DefaultRoleName, PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from './permission.enum';

/**
 * 16/09/2026: bo sung - toan bo enum/hang so trong thu muc nay (dung chung boi 6 service backend +
 * frontend) truoc day KHONG co test nao, khien coverageThreshold "functions" (30%) cua goi
 * common-dto tut xuong 28.57% sau 1 lan chay lai toan bo gate (phat hien qua merge nhanh frontend
 * cua Tien). Cac enum nay la HOP DONG du lieu quan trong (gia tri chuoi duoc luu thang vao DB/so
 * sanh xuyen nhieu service) - 1 lan doi ten/xoa nham 1 gia tri se gay loi ngam rat kho phat hien
 * (vd DB da co san hang nghin dong voi gia tri cu). Test nay khong chi lap day nguong coverage ma
 * con la 1 luoi an toan that su chong doi ten/xoa nham.
 */
describe('TaskStatus / ProjectStatus', () => {
  it('giu dung 3 gia tri TaskStatus (khop schema DB hien co)', () => {
    expect(Object.values(TaskStatus)).toEqual(['TODO', 'DOING', 'DONE']);
  });

  it('giu dung 3 gia tri ProjectStatus', () => {
    expect(Object.values(ProjectStatus)).toEqual(['ACTIVE', 'COMPLETED', 'ARCHIVED']);
  });

  it('TASK_STATUS_TRANSITIONS co du 3 khoa, khong co chuyen tiep nao tro ve chinh no', () => {
    for (const status of Object.values(TaskStatus)) {
      expect(TASK_STATUS_TRANSITIONS[status]).toBeDefined();
      expect(TASK_STATUS_TRANSITIONS[status]).not.toContain(status);
    }
  });
});

describe('DealStage', () => {
  it('giu dung 6 gia tri (khop pipeline ban hang CRM-lite)', () => {
    expect(Object.values(DealStage)).toEqual(['NEW', 'CONTACTED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']);
  });

  it('WON/LOST la trang thai CUOI - khong con chuyen tiep nao', () => {
    expect(DEAL_STAGE_TRANSITIONS[DealStage.WON]).toEqual([]);
    expect(DEAL_STAGE_TRANSITIONS[DealStage.LOST]).toEqual([]);
  });

  it('4 giai doan dang hoat dong deu chuyen tiep duoc toi WON va LOST', () => {
    const activeStages = [DealStage.NEW, DealStage.CONTACTED, DealStage.PROPOSAL, DealStage.NEGOTIATION];
    for (const stage of activeStages) {
      expect(DEAL_STAGE_TRANSITIONS[stage]).toContain(DealStage.WON);
      expect(DEAL_STAGE_TRANSITIONS[stage]).toContain(DealStage.LOST);
      expect(DEAL_STAGE_TRANSITIONS[stage]).not.toContain(stage);
    }
  });
});

describe('LeaveRequestStatus / CalendarEventType', () => {
  it('giu dung 3 gia tri LeaveRequestStatus', () => {
    expect(Object.values(LeaveRequestStatus)).toEqual(['PENDING', 'APPROVED', 'REJECTED']);
  });

  it('giu dung 2 gia tri CalendarEventType', () => {
    expect(Object.values(CalendarEventType)).toEqual(['HOLIDAY', 'EVENT']);
  });
});

describe('DefaultRoleName / PERMISSIONS / DEFAULT_ROLE_PERMISSIONS', () => {
  it('giu dung 3 vai tro mac dinh (khop RolesService.seedDefaultRoles())', () => {
    expect(Object.values(DefaultRoleName)).toEqual(['Org Admin', 'Manager', 'Employee']);
  });

  it('Org Admin luon ke thua TOAN BO permission he thong (khong sot key moi them ve sau)', () => {
    expect(DEFAULT_ROLE_PERMISSIONS[DefaultRoleName.ORG_ADMIN]).toEqual(Object.values(PERMISSIONS));
  });

  it('Manager/Employee chi la tap con cua toan bo permission (khong co key la)', () => {
    const allPermissions = new Set(Object.values(PERMISSIONS));
    for (const perm of DEFAULT_ROLE_PERMISSIONS[DefaultRoleName.MANAGER]) {
      expect(allPermissions.has(perm)).toBe(true);
    }
    for (const perm of DEFAULT_ROLE_PERMISSIONS[DefaultRoleName.EMPLOYEE]) {
      expect(allPermissions.has(perm)).toBe(true);
    }
  });

  // 03/10/2026 (thay the test 16/09/2026): Lich cong ty mo rong quyen - CALENDAR_MANAGE gio la "co
  // quan ly lich nang cao", Org Admin VA Manager deu co, rieng Employee thi khong (xem chu thich
  // permission.enum.ts va CalendarEventsService).
  it('CALENDAR_MANAGE thuoc ve Org Admin va Manager, khong o Employee', () => {
    expect(DEFAULT_ROLE_PERMISSIONS[DefaultRoleName.MANAGER]).toContain(PERMISSIONS.CALENDAR_MANAGE);
    expect(DEFAULT_ROLE_PERMISSIONS[DefaultRoleName.EMPLOYEE]).not.toContain(PERMISSIONS.CALENDAR_MANAGE);
  });
});
