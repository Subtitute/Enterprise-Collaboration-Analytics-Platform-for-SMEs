import { Fragment, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { LockIcon, ShieldIcon } from '@/components/ui/Icons';
import { usePermissionsQuery, useRolesQuery, useUpdateRolePermissions } from './hooks';
import type { Permission, RoleWithPermissions } from '@/types';
import {
  PERMISSION_META,
  MODULE_ORDER,
  isOrgAdminRole,
  formatRoleName,
} from './roles-permissions.constants';
import { PermissionRow } from './components/PermissionRow';
import { PermissionModuleHeader } from './components/PermissionModuleHeader';
import { MobileRolesView } from './components/MobileRolesView';

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
  const togglePermission = useCallback((role: RoleWithPermissions, permissionKey: string) => {
    if (isOrgAdminRole(role.name)) return; // Safety Lock
    const has = role.permissionKeys.includes(permissionKey);
    const nextKeys = has ? role.permissionKeys.filter((k) => k !== permissionKey) : [...role.permissionKeys, permissionKey];
    updatePermissions.mutate({ roleId: role.id, permissionKeys: nextKeys });
  }, [updatePermissions]);

  // Thao tác hàng loạt 1: Bật / Tắt toàn bộ quyền trong 1 module cho 1 vai trò
  const toggleModulePermissions = useCallback((role: RoleWithPermissions, modulePerms: Permission[]) => {
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
  }, [updatePermissions]);

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

          {/* Mobile view: Role selection tabs + Module permission cards */}
          <div className="block md:hidden">
            <MobileRolesView
              roles={roles}
              groupedModules={groupedModules}
              isPending={updatePermissions.isPending}
              onTogglePermission={togglePermission}
              onToggleModule={toggleModulePermissions}
            />
          </div>

          {/* Desktop/Tablet view: Full matrix table with independent horizontal scroll */}
          <div className="hidden md:block rounded-radius-md border border-border-subtle bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[280px]" />
                  {roles.map((r) => (
                    <col key={r.id} className="w-40" />
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
                      <PermissionModuleHeader
                        moduleName={mod.name}
                        modulePermissions={mod.permissions}
                        roles={roles}
                        isPending={updatePermissions.isPending}
                        isFirst={modIdx === 0}
                        onToggleModule={toggleModulePermissions}
                      />

                      {/* Các dòng quyền cụ thể trong module: typography thoáng, viền border-b nhẹ */}
                      {mod.permissions.map((p) => (
                        <PermissionRow
                          key={p.key}
                          permission={p}
                          roles={roles}
                          isPending={updatePermissions.isPending}
                          onToggle={togglePermission}
                        />
                      ))}
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
