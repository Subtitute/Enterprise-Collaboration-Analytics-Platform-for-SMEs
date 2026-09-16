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

/**
 * Bản đồ dịch tên quyền kỹ thuật sang tiếng Việt tường minh và chỉ định phân hệ module.
 */
interface PermissionMeta {
  label: string;
  moduleKey: 'hrm' | 'crm' | 'project' | 'document' | 'analytics' | 'iam' | 'system';
  order: number;
}

const PERMISSION_META: Record<string, PermissionMeta> = {
  // HRM-lite: Chấm công & Nghỉ phép
  'attendance:checkin': { label: 'Chấm công (Check-in / Check-out)', moduleKey: 'hrm', order: 1 },
  'attendance:view': { label: 'Xem bảng chấm công toàn công ty', moduleKey: 'hrm', order: 2 },
  'leave_request:create': { label: 'Tạo đơn xin nghỉ phép', moduleKey: 'hrm', order: 3 },
  'leave_request:view': { label: 'Xem danh sách đơn nghỉ phép', moduleKey: 'hrm', order: 4 },
  'leave_request:approve': { label: 'Duyệt / Từ chối đơn nghỉ phép', moduleKey: 'hrm', order: 5 },

  // CRM-lite: Khách hàng & Bán hàng
  'customer:view': { label: 'Xem danh sách khách hàng', moduleKey: 'crm', order: 10 },
  'customer:create': { label: 'Tạo mới hồ sơ khách hàng', moduleKey: 'crm', order: 11 },
  'customer:update': { label: 'Cập nhật thông tin khách hàng', moduleKey: 'crm', order: 12 },
  'customer:delete': { label: 'Xóa khách hàng', moduleKey: 'crm', order: 13 },
  'deal:view': { label: 'Xem cơ hội bán hàng (Deal pipeline)', moduleKey: 'crm', order: 14 },
  'deal:create': { label: 'Tạo cơ hội bán hàng mới', moduleKey: 'crm', order: 15 },
  'deal:update': { label: 'Cập nhật giai đoạn / giá trị deal', moduleKey: 'crm', order: 16 },
  'deal:delete': { label: 'Xóa cơ hội bán hàng', moduleKey: 'crm', order: 17 },

  // Project & Task: Dự án & Công việc
  'project:view': { label: 'Xem danh sách & chi tiết dự án', moduleKey: 'project', order: 20 },
  'project:create': { label: 'Khởi tạo dự án mới', moduleKey: 'project', order: 21 },
  'project:update': { label: 'Cập nhật thông tin / trạng thái dự án', moduleKey: 'project', order: 22 },
  'project:delete': { label: 'Lưu trữ / Xóa dự án', moduleKey: 'project', order: 23 },
  'task:view': { label: 'Xem bảng công việc (Kanban & List)', moduleKey: 'project', order: 24 },
  'task:create': { label: 'Giao việc / Tạo mới công việc', moduleKey: 'project', order: 25 },
  'task:update': { label: 'Cập nhật tiến độ / kéo thả trạng thái việc', moduleKey: 'project', order: 26 },
  'task:delete': { label: 'Xóa công việc', moduleKey: 'project', order: 27 },

  // Document: Tài liệu & Lưu trữ
  'document:view': { label: 'Xem & tải xuống tài liệu', moduleKey: 'document', order: 30 },
  'document:upload': { label: 'Tải lên tài liệu & tạo thư mục', moduleKey: 'document', order: 31 },
  'document:share': { label: 'Chia sẻ tài liệu nội bộ / liên kết', moduleKey: 'document', order: 32 },
  'document:delete': { label: 'Xóa tài liệu / thư mục', moduleKey: 'document', order: 33 },

  // Analytics: Báo cáo & Phân tích
  'analytics:view': { label: 'Xem báo cáo KPI & phân tích tổng hợp', moduleKey: 'analytics', order: 40 },

  // Organization & IAM: Tổ chức & Phân quyền
  'user:invite': { label: 'Mời thành viên mới vào tổ chức', moduleKey: 'iam', order: 50 },
  'user:manage': { label: 'Quản lý tài khoản (Đổi quyền, vô hiệu hóa)', moduleKey: 'iam', order: 51 },
  'department:manage': { label: 'Quản lý cơ cấu phòng ban', moduleKey: 'iam', order: 52 },
  'role:manage': { label: 'Quản lý & cấu hình ma trận phân quyền', moduleKey: 'iam', order: 53 },
  'organization:manage': { label: 'Quản lý thông tin tổ chức / doanh nghiệp', moduleKey: 'iam', order: 54 },

  // System & Diagnostics: Hạ tầng & Hệ thống
  'system:manage': { label: 'Chẩn đoán hạ tầng & theo dõi Dead Letter Queue', moduleKey: 'system', order: 60 },
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
  return lower.includes('org admin') || lower === 'admin' || lower.includes('quản trị viên tối cao') || lower.includes('organization admin');
}

/**
 * Định dạng tên vai trò theo ngôn ngữ hiện hành
 */
function formatRoleName(roleName: string, t: (key: string) => string): string {
  const lower = roleName.trim().toLowerCase();
  if (lower.includes('admin') || lower.includes('quản trị')) {
    return t('admin:roles.orgAdmin');
  }
  if (lower.includes('manager') || lower.includes('quản lý')) {
    return t('admin:roles.manager');
  }
  if (lower.includes('employee') || lower.includes('nhân viên')) {
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
  );
}
