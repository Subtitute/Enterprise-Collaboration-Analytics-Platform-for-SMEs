import { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Input';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { LockIcon, ShieldIcon } from '@/components/ui/Icons';
import { usePermissionsQuery, useRolesQuery, useUpdateRolePermissions } from './hooks';
import type { Permission, RoleWithPermissions } from '@/types';
// 16/09/2026: PERMISSION_META la hang so o module-level (ngoai component) nen khong the goi
// useTranslation() o day (vi pham Rules of Hooks) - dung tham chieu `t` khong-qua-hook tu
// i18n/index.ts, theo dung tien le da ap dung o TaskStatusDonut.tsx.
import { t } from '@/i18n';

/**
 * Bản đồ dịch tên quyền kỹ thuật sang tiếng Việt tường minh và chỉ định phân hệ module.
 */
// 24/10/2026: bo sung 20 quyen ra doi sau map nay (giai trinh/tang ca, lich cong ty, ml:view, San
// pham & Kho, Nhan tin, chatbot:use) - truoc day chung roi vao nhom 'Khac' voi nhan la key ky
// thuat tho nen Org Admin kho nhan ra de bat/tat. Them 2 nhom moi 'inventory' va 'messaging';
// PERMISSION_META duoc export de RolesPermissionsPage.test.ts doi chieu voi PERMISSIONS (common-dto),
// quyen moi nao quen khai bao o day se lam test that bai.
type ModuleKey = 'hrm' | 'crm' | 'inventory' | 'project' | 'document' | 'messaging' | 'analytics' | 'iam' | 'system';

interface PermissionMeta {
  label: string;
  moduleKey: ModuleKey;
  order: number;
}

// 16/09/2026: cac `label` duoi day tung la chuoi tieng Viet hardcode truc tiep (vi pham
// scripts/check-hardcoded-vietnamese.js) - chuyen sang goi t() voi key
// admin:rolesPermissionsPage.permissions.<key voi ':' -> '_'>, dung key da co san (va dung khop
// tung ky tu) trong locales/{vi,en,ja}/admin.json, giong cach translationKey duoc dung khi render
// ben duoi nen khong tao trung lap noi dung dich.
export const PERMISSION_META: Record<string, PermissionMeta> = {
  // HRM-lite: Chấm công & Nghỉ phép
  'attendance:checkin': { label: t('admin:rolesPermissionsPage.permissions.attendance_checkin'), moduleKey: 'hrm', order: 1 },
  'attendance:view': { label: t('admin:rolesPermissionsPage.permissions.attendance_view'), moduleKey: 'hrm', order: 2 },
  'leave_request:create': { label: t('admin:rolesPermissionsPage.permissions.leave_request_create'), moduleKey: 'hrm', order: 3 },
  'leave_request:view': { label: t('admin:rolesPermissionsPage.permissions.leave_request_view'), moduleKey: 'hrm', order: 4 },
  'leave_request:approve': { label: t('admin:rolesPermissionsPage.permissions.leave_request_approve'), moduleKey: 'hrm', order: 5 },
  'attendance_adjustment:create': { label: t('admin:rolesPermissionsPage.permissions.attendance_adjustment_create'), moduleKey: 'hrm', order: 6 },
  'attendance_adjustment:view': { label: t('admin:rolesPermissionsPage.permissions.attendance_adjustment_view'), moduleKey: 'hrm', order: 7 },
  'attendance_adjustment:approve': { label: t('admin:rolesPermissionsPage.permissions.attendance_adjustment_approve'), moduleKey: 'hrm', order: 8 },
  'overtime_request:create': { label: t('admin:rolesPermissionsPage.permissions.overtime_request_create'), moduleKey: 'hrm', order: 9 },
  'overtime_request:view': { label: t('admin:rolesPermissionsPage.permissions.overtime_request_view'), moduleKey: 'hrm', order: 10 },
  'overtime_request:approve': { label: t('admin:rolesPermissionsPage.permissions.overtime_request_approve'), moduleKey: 'hrm', order: 11 },
  'calendar:manage': { label: t('admin:rolesPermissionsPage.permissions.calendar_manage'), moduleKey: 'hrm', order: 12 },

  // CRM-lite: Khách hàng & Bán hàng
  'customer:view': { label: t('admin:rolesPermissionsPage.permissions.customer_view'), moduleKey: 'crm', order: 10 },
  'customer:create': { label: t('admin:rolesPermissionsPage.permissions.customer_create'), moduleKey: 'crm', order: 11 },
  'customer:update': { label: t('admin:rolesPermissionsPage.permissions.customer_update'), moduleKey: 'crm', order: 12 },
  'customer:delete': { label: t('admin:rolesPermissionsPage.permissions.customer_delete'), moduleKey: 'crm', order: 13 },
  'deal:view': { label: t('admin:rolesPermissionsPage.permissions.deal_view'), moduleKey: 'crm', order: 14 },
  'deal:create': { label: t('admin:rolesPermissionsPage.permissions.deal_create'), moduleKey: 'crm', order: 15 },
  'deal:update': { label: t('admin:rolesPermissionsPage.permissions.deal_update'), moduleKey: 'crm', order: 16 },
  'deal:delete': { label: t('admin:rolesPermissionsPage.permissions.deal_delete'), moduleKey: 'crm', order: 17 },

  // 24/10/2026: Inventory: Sản phẩm & Kho (gồm giao dịch mua hàng của khách)
  'product:view': { label: t('admin:rolesPermissionsPage.permissions.product_view'), moduleKey: 'inventory', order: 70 },
  'product:manage': { label: t('admin:rolesPermissionsPage.permissions.product_manage'), moduleKey: 'inventory', order: 71 },
  'warehouse:view': { label: t('admin:rolesPermissionsPage.permissions.warehouse_view'), moduleKey: 'inventory', order: 72 },
  'warehouse:manage': { label: t('admin:rolesPermissionsPage.permissions.warehouse_manage'), moduleKey: 'inventory', order: 73 },
  'customer_purchase:view': { label: t('admin:rolesPermissionsPage.permissions.customer_purchase_view'), moduleKey: 'inventory', order: 74 },
  'customer_purchase:create': { label: t('admin:rolesPermissionsPage.permissions.customer_purchase_create'), moduleKey: 'inventory', order: 75 },
  'customer_purchase:update': { label: t('admin:rolesPermissionsPage.permissions.customer_purchase_update'), moduleKey: 'inventory', order: 76 },
  'customer_purchase:delete': { label: t('admin:rolesPermissionsPage.permissions.customer_purchase_delete'), moduleKey: 'inventory', order: 77 },

  // Project & Task: Dự án & Công việc
  'project:view': { label: t('admin:rolesPermissionsPage.permissions.project_view'), moduleKey: 'project', order: 20 },
  'project:create': { label: t('admin:rolesPermissionsPage.permissions.project_create'), moduleKey: 'project', order: 21 },
  'project:update': { label: t('admin:rolesPermissionsPage.permissions.project_update'), moduleKey: 'project', order: 22 },
  'project:delete': { label: t('admin:rolesPermissionsPage.permissions.project_delete'), moduleKey: 'project', order: 23 },
  'task:view': { label: t('admin:rolesPermissionsPage.permissions.task_view'), moduleKey: 'project', order: 24 },
  'task:create': { label: t('admin:rolesPermissionsPage.permissions.task_create'), moduleKey: 'project', order: 25 },
  'task:update': { label: t('admin:rolesPermissionsPage.permissions.task_update'), moduleKey: 'project', order: 26 },
  'task:delete': { label: t('admin:rolesPermissionsPage.permissions.task_delete'), moduleKey: 'project', order: 27 },

  // Document: Tài liệu & Lưu trữ
  'document:view': { label: t('admin:rolesPermissionsPage.permissions.document_view'), moduleKey: 'document', order: 30 },
  'document:upload': { label: t('admin:rolesPermissionsPage.permissions.document_upload'), moduleKey: 'document', order: 31 },
  'document:share': { label: t('admin:rolesPermissionsPage.permissions.document_share'), moduleKey: 'document', order: 32 },
  'document:delete': { label: t('admin:rolesPermissionsPage.permissions.document_delete'), moduleKey: 'document', order: 33 },

  // 24/10/2026: Messaging: Nhắn tin & Trợ lý AI (chatbot)
  'message:view': { label: t('admin:rolesPermissionsPage.permissions.message_view'), moduleKey: 'messaging', order: 80 },
  'message:send': { label: t('admin:rolesPermissionsPage.permissions.message_send'), moduleKey: 'messaging', order: 81 },
  'message:manage_group': { label: t('admin:rolesPermissionsPage.permissions.message_manage_group'), moduleKey: 'messaging', order: 82 },
  'chatbot:use': { label: t('admin:rolesPermissionsPage.permissions.chatbot_use'), moduleKey: 'messaging', order: 83 },

  // Analytics: Báo cáo & Phân tích
  'analytics:view': { label: t('admin:rolesPermissionsPage.permissions.analytics_view'), moduleKey: 'analytics', order: 40 },
  'ml:view': { label: t('admin:rolesPermissionsPage.permissions.ml_view'), moduleKey: 'analytics', order: 41 },

  // Organization & IAM: Tổ chức & Phân quyền
  'user:invite': { label: t('admin:rolesPermissionsPage.permissions.user_invite'), moduleKey: 'iam', order: 50 },
  'user:manage': { label: t('admin:rolesPermissionsPage.permissions.user_manage'), moduleKey: 'iam', order: 51 },
  'department:manage': { label: t('admin:rolesPermissionsPage.permissions.department_manage'), moduleKey: 'iam', order: 52 },
  'role:manage': { label: t('admin:rolesPermissionsPage.permissions.role_manage'), moduleKey: 'iam', order: 53 },
  'organization:manage': { label: t('admin:rolesPermissionsPage.permissions.organization_manage'), moduleKey: 'iam', order: 54 },

  // System & Diagnostics: Hạ tầng & Hệ thống
  'system:manage': { label: t('admin:rolesPermissionsPage.permissions.system_manage'), moduleKey: 'system', order: 60 },
};

/** Danh sách thứ tự hiển thị của các module nghiệp vụ */
const MODULE_ORDER: Array<{ key: ModuleKey }> = [
  { key: 'hrm' },
  { key: 'crm' },
  { key: 'inventory' },
  { key: 'project' },
  { key: 'document' },
  { key: 'messaging' },
  { key: 'analytics' },
  { key: 'iam' },
  { key: 'system' },
];

/**
 * Kiểm tra xem vai trò có phải là Org Admin (Quản trị viên tối cao) hay không để áp dụng cơ chế khóa an toàn (Safety Lock)
 */
function isOrgAdminRole(roleName: string): boolean {
  const lower = roleName.trim().toLowerCase();
  // 16/09/2026: chuoi tieng Viet ben duoi la gia tri SO KHOP ten vai tro (phong truong hop 1 to
  // chuc da tu doi ten vai tro sang tieng Viet), khong phai text hien thi cho nguoi dung - text
  // hien thi luon di qua t() o formatRoleName ben duoi. (i18n-lint-ignore)
  return lower.includes('org admin') || lower === 'admin' || lower.includes('quản trị viên tối cao') || lower.includes('organization admin');
}

/**
 * Định dạng tên vai trò theo ngôn ngữ hiện hành
 */
function formatRoleName(roleName: string, t: (key: string) => string): string {
  const lower = roleName.trim().toLowerCase();
  // 16/09/2026: cac chuoi tieng Viet trong 3 dieu kien duoi day la gia tri SO KHOP ten vai tro cu/
  // da tuy chinh, khong phai text hien thi cho nguoi dung - text hien thi luon di qua t() ngay ben duoi.
  if (lower.includes('admin') || lower.includes('quản trị')) { // i18n-lint-ignore
    return t('admin:roles.orgAdmin');
  }
  if (lower.includes('manager') || lower.includes('quản lý')) { // i18n-lint-ignore
    return t('admin:roles.manager');
  }
  if (lower.includes('employee') || lower.includes('nhân viên')) { // i18n-lint-ignore
    return t('admin:roles.employee');
  }
  return roleName;
}

export function RolesPermissionsPage() {
  const { t } = useTranslation();
  const rolesQuery = useRolesQuery();
  const permissionsQuery = usePermissionsQuery();
  const updatePermissions = useUpdateRolePermissions();

  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];

  // Nhóm danh sách quyền theo module nghiệp vụ và sắp xếp logic
  const groupedModules = useMemo(() => {
    const map: Record<string, Permission[]> = {};

    for (const p of permissions) {
      const meta = PERMISSION_META[p.key];
      const modKey = meta ? meta.moduleKey : 'other';
      (map[modKey] ??= []).push(p);
    }

    // Sắp xếp các quyền bên trong từng module theo thứ tự nghiệp vụ
    for (const modKey of Object.keys(map)) {
      map[modKey].sort((a, b) => {
        const orderA = PERMISSION_META[a.key]?.order ?? 999;
        const orderB = PERMISSION_META[b.key]?.order ?? 999;
        return orderA - orderB;
      });
    }

    // Trả về danh sách module theo thứ tự chuẩn
    const ordered: Array<{ key: string; name: string; permissions: Permission[] }> = [];
    for (const mod of MODULE_ORDER) {
      if (map[mod.key]?.length) {
        ordered.push({
          key: mod.key,
          name: t(`admin:rolesPermissionsPage.groups.${mod.key}`),
          permissions: map[mod.key],
        });
      }
    }

    if (map['other']?.length) {
      ordered.push({
        key: 'other',
        name: t('admin:rolesPermissionsPage.otherGroup'),
        permissions: map['other'],
      });
    }

    return ordered;
  }, [permissions, t]);

  // Bật/tắt 1 quyền đơn lẻ cho 1 vai trò
  function togglePermission(role: RoleWithPermissions, permissionKey: string) {
    if (isOrgAdminRole(role.name)) return; // Safety Lock
    const has = role.permissionKeys.includes(permissionKey);
    const nextKeys = has ? role.permissionKeys.filter((k) => k !== permissionKey) : [...role.permissionKeys, permissionKey];
    updatePermissions.mutate({ roleId: role.id, permissionKeys: nextKeys });
  }

  // Thao tác hàng loạt 1: Bật / Tắt toàn bộ quyền trong 1 module cho 1 vai trò
  function toggleModulePermissions(role: RoleWithPermissions, modulePerms: Permission[]) {
    if (isOrgAdminRole(role.name)) return; // Safety Lock
    const moduleKeys = modulePerms.map((p) => p.key);
    const hasAll = moduleKeys.every((k) => role.permissionKeys.includes(k));

    let nextKeys: string[];
    if (hasAll) {
      // Đang có toàn bộ -> bỏ chọn toàn bộ module này
      nextKeys = role.permissionKeys.filter((k) => !moduleKeys.includes(k));
    } else {
      // Chưa đủ -> thêm toàn bộ module này
      const merged = new Set([...role.permissionKeys, ...moduleKeys]);
      nextKeys = Array.from(merged);
    }
    updatePermissions.mutate({ roleId: role.id, permissionKeys: nextKeys });
  }

  return (
    <QueryState
      isLoading={rolesQuery.isLoading || permissionsQuery.isLoading}
      isError={rolesQuery.isError || permissionsQuery.isError}
      onRetry={() => {
        rolesQuery.refetch();
        permissionsQuery.refetch();
      }}
      loadingFallback={<FullPageSpinner label={t('admin:rolesPermissionsPage.loading')} />}
      errorTitle={t('admin:rolesPermissionsPage.errorTitle')}
    >
      {roles.length === 0 || permissions.length === 0 ? (
        <div className="rounded-radius-md border border-border-subtle bg-white p-6">
          <EmptyState icon={<ShieldIcon className="h-8 w-8 text-text-tertiary" />} title={t('admin:rolesPermissionsPage.emptyTitle')} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Banner mô tả: nền bg-subtle, radius 8, padding 12, font 13/400 text-secondary */}
          <div className="rounded-radius-md border border-border-subtle bg-bg-subtle p-3 text-[13px] leading-5 text-text-secondary">
            {t('admin:rolesPermissionsPage.hint')}
          </div>

          <div className="rounded-radius-md border border-border-subtle bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] table-fixed border-collapse text-sm">
                <colgroup>
                  {/* Cột tên quyền chiếm phần lớn không gian, các cột vai trò chia đều tỉ lệ cố định */}
                  <col className="w-auto" />
                  {roles.map((r) => (
                    <col key={r.id} className="w-36 sm:w-44" />
                  ))}
                </colgroup>

                <thead>
                  <tr className="border-b border-border-subtle bg-bg-subtle">
                    <th className="sticky left-0 z-20 bg-bg-subtle px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                      {t('admin:rolesPermissionsPage.permissionColumn')}
                    </th>
                    {roles.map((r) => {
                      const isLocked = isOrgAdminRole(r.name);
                      const localizedRoleName = formatRoleName(r.name, t);

                      return (
                        <th key={r.id} className="px-4 py-3 text-center text-[12px] font-semibold text-text-primary">
                          <div className="flex w-full items-center justify-center text-center">
                            <span className="inline-flex items-center justify-center gap-1.5 font-semibold text-text-primary">
                              {localizedRoleName}
                              {isLocked && (
                                <span title={t('admin:rolesPermissionsPage.lockedTooltip')}>
                                  <LockIcon className="h-3 w-3 text-text-tertiary" />
                                </span>
                              )}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {groupedModules.map((mod, modIdx) => (
                    <Fragment key={mod.key}>
                      {/* Hàng tiêu đề nhóm phân hệ module: nền bg-subtle, border-y, typography đậm nét, pill đếm số quyền */}
                      <tr className={`border-y border-border-subtle bg-bg-subtle/80 ${modIdx > 0 ? 'border-t-2 border-t-border-subtle' : ''}`}>
                        <td className="sticky left-0 z-10 bg-bg-subtle px-5 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-text-primary tracking-wide">
                              {mod.name}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-border-subtle px-2 py-0.5 text-[11px] font-medium text-text-secondary font-mono tabular-nums">
                              {mod.permissions.length}
                            </span>
                          </div>
                        </td>

                        {/* Các ô chọn hàng loạt cho từng vai trò trong module này */}
                        {roles.map((r) => {
                          const isLocked = isOrgAdminRole(r.name);
                          const modKeys = mod.permissions.map((p) => p.key);
                          const allModSelected = modKeys.length > 0 && modKeys.every((k) => r.permissionKeys.includes(k));

                          return (
                            <td key={r.id} className="px-4 py-2 text-center">
                              <div className="flex w-full items-center justify-center">
                                {isLocked ? (
                                  <div className="flex h-7 items-center justify-center">
                                    <span
                                      className="inline-flex h-4 w-4 items-center justify-center rounded-[2px] border border-dashed border-border-strong bg-bg-muted text-text-tertiary cursor-not-allowed select-none"
                                      title={t('admin:rolesPermissionsPage.lockedTooltip')}
                                    >
                                      <LockIcon className="h-3 w-3 text-text-secondary" />
                                    </span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => toggleModulePermissions(r, mod.permissions)}
                                    disabled={updatePermissions.isPending}
                                    title={t('admin:rolesPermissionsPage.selectAllModule')}
                                    aria-label={t('admin:rolesPermissionsPage.moduleSelectAllAria', {
                                      roleName: r.name,
                                      groupName: mod.name,
                                    })}
                                    className="inline-flex items-center justify-center h-7 px-2.5 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50 select-none"
                                  >
                                    {allModSelected ? '✓ ' : ''}{t('admin:rolesPermissionsPage.selectAll')}
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Các dòng quyền cụ thể trong module: typography thoáng, viền border-b nhẹ */}
                      {mod.permissions.map((p) => {
                        const meta = PERMISSION_META[p.key];
                        const safeKey = p.key.replace(':', '_');
                        const translationKey = `admin:rolesPermissionsPage.permissions.${safeKey}`;
                        const displayTitle = t(translationKey, { defaultValue: meta?.label ?? p.description ?? p.key });

                        return (
                          <tr key={p.key} className="border-b border-border-subtle hover:bg-bg-subtle transition-colors">
                            <td className="sticky left-0 z-10 bg-white px-5 py-3">
                              <span className="text-[13px] font-medium text-text-primary">
                                {displayTitle}
                              </span>
                            </td>

                            {roles.map((r) => {
                              const isLocked = isOrgAdminRole(r.name);
                              const isChecked = isLocked ? true : r.permissionKeys.includes(p.key);

                              return (
                                <td key={r.id} className="px-4 py-3 text-center">
                                  <div className="flex w-full items-center justify-center">
                                    {isLocked ? (
                                      <span
                                        className="inline-flex h-4 w-4 items-center justify-center rounded-[2px] border border-dashed border-border-strong bg-bg-muted cursor-not-allowed select-none"
                                        title={t('admin:rolesPermissionsPage.lockedTooltip')}
                                      >
                                        <LockIcon className="h-3 w-3 text-text-secondary" />
                                      </span>
                                    ) : (
                                      <Checkbox
                                        checked={isChecked}
                                        onChange={() => togglePermission(r, p.key)}
                                        disabled={updatePermissions.isPending}
                                        className="h-4 w-4 rounded-[2px] cursor-pointer"
                                        aria-label={t('admin:rolesPermissionsPage.checkboxAriaLabel', {
                                          roleName: r.name,
                                          permissionLabel: displayTitle,
                                        })}
                                      />
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </QueryState>
  );
}
