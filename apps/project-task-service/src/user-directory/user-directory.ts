import { DataSource } from 'typeorm';
import { AuthContext, DomainEvent, EVENT_TYPES, resolveDataScope } from '@app/common-dto';
import { DimUser } from '../entities/dim-user.entity';

/**
 * 26/10/2026: logic thuan cua read-model dim_user (tach khoi KafkaJS de unit test doc lap) - xem
 * DimUser va UserDirectoryConsumer. Moi su kien IAM duoc ap dung theo kieu "gia tri moi nhat thang"
 * (upsert theo userId) nen phat lai bao nhieu lan cung an toan - IAM Service tu phat lai
 * USER_DEPARTMENT_CHANGED cho MOI user moi lan khoi dong (UserDepartmentSyncService), chinh co che
 * tu lanh (self-heal) cua bang nay neu tung lech pha.
 *
 * DO TRE (chap nhan duoc o quy mo do an): doi phong ban ben IAM chi phan anh vao day sau khi
 * outbox -> Kafka -> consumer xu ly (vai giay); ban ghi thuoc phong ban cu se hien voi Manager cu
 * cho toi luc do.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asUuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

/** Tra ve true neu su kien thuoc nhom duoc ap dung (de test/ghi log), false neu bo qua. */
export async function applyDirectoryEvent(dataSource: DataSource, event: DomainEvent): Promise<boolean> {
  const payload = (event?.payload ?? {}) as Record<string, unknown>;
  const userId = asUuid(payload.userId);
  const organizationId = asUuid(event?.organizationId);
  if (!userId || !organizationId) return false;

  const repo = dataSource.getRepository(DimUser);
  if (event.eventType === EVENT_TYPES.USER_REGISTERED || event.eventType === EVENT_TYPES.USER_DEPARTMENT_CHANGED) {
    await repo.upsert({ userId, organizationId, departmentId: asUuid(payload.departmentId), updatedAt: new Date() }, ['userId']);
    return true;
  }
  if (event.eventType === EVENT_TYPES.USER_DELETED) {
    await repo.delete({ userId, organizationId });
    return true;
  }
  return false;
}

/** Parse 1 message Kafka tho; JSON hong bi bo qua (khong rethrow - retry cung message khong bao gio thanh cong). */
export async function handleDirectoryMessage(dataSource: DataSource, raw: Buffer | null): Promise<boolean> {
  if (!raw) return false;
  let event: DomainEvent;
  try {
    event = JSON.parse(raw.toString()) as DomainEvent;
  } catch {
    return false;
  }
  return applyDirectoryEvent(dataSource, event);
}

/** Ngu canh nguoi goi cho pham vi xem (userId/permissions/departmentId lay tu JWT qua AuthContext). */
export interface ScopeCaller {
  userId: string;
  permissions: string[];
  departmentId: string | null;
}

// 26/10/2026: dung ScopeCaller tu AuthContext - cac endpoint GHI theo id cung kiem tra pham vi xem (giong crm-service).
export function toScopeCaller(ctx: AuthContext): ScopeCaller {
  return { userId: ctx.userId, permissions: ctx.permissions ?? [], departmentId: ctx.departmentId ?? null };
}

/** Danh sach userId HIEN dang thuoc 1 phong ban cua to chuc - dung cho pham vi 'department'. */
export async function listDepartmentUserIds(
  dataSource: DataSource,
  organizationId: string,
  departmentId: string,
): Promise<string[]> {
  const rows = await dataSource.getRepository(DimUser).find({ where: { organizationId, departmentId }, select: ['userId'] });
  return rows.map((row) => row.userId);
}

/**
 * Tap nguoi dung "dai dien" cho pham vi xem cua nguoi goi (resolveDataScope, @app/common-dto):
 * null = khong gioi han (Org Admin); [userId] = chi chinh minh; [userId + thanh vien phong ban] =
 * Manager. `departmentScopePermission` la quyen cap Manager rieng cua module (vd PROJECT_CREATE).
 */
export async function resolveScopeUserIds(
  dataSource: DataSource,
  organizationId: string,
  userId: string,
  permissions: string[],
  departmentScopePermission: string,
  departmentId: string | null,
): Promise<string[] | null> {
  const scope = resolveDataScope(permissions, departmentScopePermission, departmentId);
  if (scope === 'organization') return null;
  if (scope === 'self' || !departmentId) return [userId];
  const members = await listDepartmentUserIds(dataSource, organizationId, departmentId);
  return Array.from(new Set([userId, ...members]));
}
