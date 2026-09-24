import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Input';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Pagination } from '@/components/ui/Pagination';
import { ClockIcon, LockIcon, ShieldIcon } from '@/components/ui/Icons';
import { usePermissionsQuery, useRoleAuditLogQuery, useRolesQuery, useUpdateRolePermissions } from './hooks';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { formatDateTime } from '@/lib/utils';
import type { Permission, RoleWithPermissions } from '@/types';
// 16/09/2026: PERMISSION_META la hang so o module-level (ngoai component) nen khong the goi
// useTranslation() o day (vi pham Rules of Hooks) - dung tham chieu `t` khong-qua-hook tu
// i18n/index.ts, theo dung tien le da ap dung o TaskStatusDonut.tsx.
import { t } from '@/i18n';

/**
 * Bản đồ dịch tên quyền kỹ thuật sang tiếng Việt tường minh và chỉ định phân hệ module.
 */
interface PermissionMeta {
  label: string;
  moduleKey: 'hrm' | 'crm' | 'project' | 'document' | 'analytics' | 'iam' | 'system';
  order: number;
}

// 16/09/2026: cac `label` duoi day tung la chuoi tieng Viet hardcode truc tiep (vi pham
// scripts/check-hardcoded-vietnamese.js) - chuyen sang goi t() voi key
// admin:rolesPermissionsPage.permissions.<key voi ':' -> '_'>, dung key da co san (va dung khop
// tung ky tu) trong locales/{vi,en,ja}/admin.json, giong cach translationKey duoc dung khi render
// ben duoi nen khong tao trung lap noi dung dich.
const PERMISSION_META: Record<string, PermissionMeta> = {
  // HRM-lite: Chấm công & Nghỉ phép
  'attendance:checkin': { label: t('admin:rolesPermissionsPage.permissions.attendance_checkin'), moduleKey: 'hrm', order: 1 },
  'attendance:view': { label: t('admin:rolesPermissionsPage.permissions.attendance_view'), moduleKey: 'hrm', order: 2 },
  'leave_request:create': { label: t('admin:rolesPermissionsPage.permissions.leave_request_create'), moduleKey: 'hrm', order: 3 },
  'leave_request:view': { label: t('admin:rolesPermissionsPage.permissions.leave_request_view'), moduleKey: 'hrm', order: 4 },
  'leave_request:approve': { label: t('admin:rolesPermissionsPage.permissions.leave_request_approve'), moduleKey: 'hrm', order: 5 },

  // CRM-lite: Khách hàng & Bán hàng
  'customer:view': { label: t('admin:rolesPermissionsPage.permissions.customer_view'), moduleKey: 'crm', order: 10 },
  'customer:create': { label: t('admin:rolesPermissionsPage.permissions.customer_create'), moduleKey: 'crm', order: 11 },
  'customer:update': { label: t('admin:rolesPermissionsPage.permissions.customer_update'), moduleKey: 'crm', order: 12 },
  'customer:delete': { label: t('admin:rolesPermissionsPage.permissions.customer_delete'), moduleKey: 'crm', order: 13 },
  'deal:view': { label: t('admin:rolesPermissionsPage.permissions.deal_view'), moduleKey: 'crm', order: 14 },
  'deal:create': { label: t('admin:rolesPermissionsPage.permissions.deal_create'), moduleKey: 'crm', order: 15 },
  'deal:update': { label: t('admin:rolesPermissionsPage.permissions.deal_update'), moduleKey: 'crm', order: 16 },
  'deal:delete': { label: t('admin:rolesPermissionsPage.permissions.deal_delete'), moduleKey: 'crm', order: 17 },

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

  // Analytics: Báo cáo & Phân tích
  'analytics:view': { label: t('admin:rolesPermissionsPage.permissions.analytics_view'), moduleKey: 'analytics', order: 40 },

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
const MODULE_ORDER: Array<{ key: 'hrm' | 'crm' | 'project' | 'document' | 'analytics' | 'iam' | 'system' }> = [
  { key: 'hrm' },
  { key: 'crm' },
  { key: 'project' },
  { key: 'document' },
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
  const [auditPage, setAuditPage] = useState(1);
  const auditLimit = 10;

  const rolesQuery = useRolesQuery();
  const permissionsQuery = usePermissionsQuery();
  const updatePermissions = useUpdateRolePermissions();
  const auditLogQuery = useRoleAuditLogQuery({ page: auditPage, limit: auditLimit });
  const { map: userNameMap } = useUserNameMap();

  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const auditLogs = auditLogQuery.data?.data ?? [];
  const auditMeta = auditLogQuery.data?.meta ?? { page: 1, limit: auditLimit, total: 0 };

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
    <div className="space-y-6">
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
        <Card className="p-6">
          <EmptyState icon={<ShieldIcon className="h-8 w-8" />} title={t('admin:rolesPermissionsPage.emptyTitle')} />
        </Card>
      ) : (
        <Card className="overflow-hidden border border-slate-200/80 shadow-2xs">
          <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-3">
            <p className="text-xs text-slate-500">{t('admin:rolesPermissionsPage.hint')}</p>
          </div>

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
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="sticky left-0 z-20 bg-slate-50 px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    {t('admin:rolesPermissionsPage.permissionColumn')}
                  </th>
                  {roles.map((r) => {
                    const isLocked = isOrgAdminRole(r.name);
                    const localizedRoleName = formatRoleName(r.name, t);

                    return (
                      <th key={r.id} className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-700">
                        <div className="flex w-full items-center justify-center text-center">
                          <span className="inline-flex items-center justify-center gap-1.5 font-bold text-slate-800">
                            {localizedRoleName}
                            {isLocked && (
                              <span title={t('admin:rolesPermissionsPage.lockedTooltip')}>
                                <LockIcon className="h-3.5 w-3.5 text-slate-500" />
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
                    {/* Hàng tiêu đề nhóm phân hệ module: nền xám nhạt trung tính, border-y, typography đậm nét, pill đếm số quyền */}
                    <tr className={`border-y border-slate-200/80 bg-slate-50/80 ${modIdx > 0 ? 'border-t-2 border-t-slate-200' : ''}`}>
                      <td className="sticky left-0 z-10 bg-slate-50/95 px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-semibold text-slate-800 tracking-wide">
                            {mod.name}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-slate-200/60 px-2 py-0.5 text-xs font-normal text-slate-600">
                            {mod.permissions.length}
                          </span>
                        </div>
                      </td>

                      {/* Các ô chọn hàng loạt cho từng vai trò trong module này: căn giữa tuyệt đối */}
                      {roles.map((r) => {
                        const isLocked = isOrgAdminRole(r.name);
                        const modKeys = mod.permissions.map((p) => p.key);
                        const allModSelected = modKeys.length > 0 && modKeys.every((k) => r.permissionKeys.includes(k));

                        return (
                          <td key={r.id} className="px-4 py-2.5 text-center">
                            <div className="flex w-full items-center justify-center">
                              {isLocked ? (
                                <div className="flex h-5 w-5 items-center justify-center">
                                  <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-slate-200 bg-slate-100 text-[10px] text-slate-400 font-bold cursor-not-allowed select-none" title={t('admin:rolesPermissionsPage.lockedTooltip')}>
                                    ✓
                                  </span>
                                </div>
                              ) : (
                                <label
                                  className="group flex flex-col items-center justify-center gap-0.5 cursor-pointer"
                                  title={t('admin:rolesPermissionsPage.selectAllModule')}
                                >
                                  <div className="flex h-5 w-5 items-center justify-center">
                                    <Checkbox
                                      checked={allModSelected}
                                      disabled={updatePermissions.isPending}
                                      onChange={() => toggleModulePermissions(r, mod.permissions)}
                                      aria-label={t('admin:rolesPermissionsPage.moduleSelectAllAria', {
                                        roleName: r.name,
                                        groupName: mod.name,
                                      })}
                                      className="cursor-pointer"
                                    />
                                  </div>
                                  <span className="text-[10px] font-medium normal-case text-indigo-600 group-hover:text-indigo-700 leading-none">
                                    {t('admin:rolesPermissionsPage.selectAll')}
                                  </span>
                                </label>
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
                        <tr key={p.key} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                          <td className="sticky left-0 z-10 bg-white px-5 py-3.5">
                            <span className="text-sm font-medium text-slate-800">
                              {displayTitle}
                            </span>
                          </td>

                          {roles.map((r) => {
                            const isLocked = isOrgAdminRole(r.name);
                            const isChecked = isLocked ? true : r.permissionKeys.includes(p.key);

                            return (
                              <td key={r.id} className="px-4 py-3.5 text-center">
                                <div className="flex w-full items-center justify-center">
                                  {isLocked ? (
                                    <span
                                      className="inline-flex h-4 w-4 items-center justify-center rounded border border-slate-200 bg-slate-100 text-[10px] text-slate-400 font-bold cursor-not-allowed select-none"
                                      title={t('admin:rolesPermissionsPage.lockedTooltip')}
                                    >
                                      ✓
                                    </span>
                                  ) : (
                                    <Checkbox
                                      checked={isChecked}
                                      onChange={() => togglePermission(r, p.key)}
                                      disabled={updatePermissions.isPending}
                                      className="cursor-pointer"
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
        </Card>
      )}
      </QueryState>

      {/* Bảng Nhật ký thay đổi phân quyền (RBAC Audit Log) */}
      <Card className="overflow-hidden border border-slate-200/80 shadow-2xs">
        <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
          <div className="flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">{t('admin:rolesPermissionsPage.auditLog.title')}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">{t('admin:rolesPermissionsPage.auditLog.subtitle')}</p>
        </div>

        <div className="overflow-x-auto">
          {auditLogQuery.isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">
              {t('common:states.loading')}
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              {t('admin:rolesPermissionsPage.auditLog.empty')}
            </div>
          ) : (
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="px-5 py-3.5 w-48">{t('admin:rolesPermissionsPage.auditLog.time')}</th>
                  <th className="px-5 py-3.5 w-44">{t('admin:rolesPermissionsPage.auditLog.role')}</th>
                  <th className="px-5 py-3.5 w-48">{t('admin:rolesPermissionsPage.auditLog.actor')}</th>
                  <th className="px-5 py-3.5">{t('admin:rolesPermissionsPage.auditLog.changes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => {
                  const actorName = log.actorId ? (userNameMap[log.actorId] ?? log.actorId) : t('admin:rolesPermissionsPage.auditLog.unknownActor');
                  const roleDisplayName = log.roleName ? formatRoleName(log.roleName, t) : t('admin:rolesPermissionsPage.auditLog.unknownRole');

                  const prevKeys = log.previousPermissionKeys ?? [];
                  const newKeys = log.newPermissionKeys ?? [];

                  const addedKeys = newKeys.filter((k) => !prevKeys.includes(k));
                  const removedKeys = prevKeys.filter((k) => !newKeys.includes(k));

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-medium text-slate-800 text-xs">
                          {roleDisplayName}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                          {actorName}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {addedKeys.map((key) => {
                            const safeKey = key.replace(':', '_');
                            const label = t(`admin:rolesPermissionsPage.permissions.${safeKey}`, { defaultValue: key });
                            return (
                              <Badge key={`added-${key}`} variant="success" className="font-normal text-[11px]">
                                + {label}
                              </Badge>
                            );
                          })}
                          {removedKeys.map((key) => {
                            const safeKey = key.replace(':', '_');
                            const label = t(`admin:rolesPermissionsPage.permissions.${safeKey}`, { defaultValue: key });
                            return (
                              <Badge key={`removed-${key}`} variant="danger" className="font-normal text-[11px]">
                                - {label}
                              </Badge>
                            );
                          })}
                          {addedKeys.length === 0 && removedKeys.length === 0 && (
                            <span className="text-xs text-slate-400 italic">
                              {t('admin:rolesPermissionsPage.auditLog.noChanges')}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {auditMeta.total > auditLimit && (
          <Pagination
            page={auditMeta.page}
            limit={auditMeta.limit}
            total={auditMeta.total}
            onPageChange={(p) => setAuditPage(p)}
          />
        )}
      </Card>
    </div>
  );
}
