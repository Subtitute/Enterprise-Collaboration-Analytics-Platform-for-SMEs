import { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Input';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { ShieldIcon } from '@/components/ui/Icons';
import { usePermissionsQuery, useRolesQuery, useUpdateRolePermissions } from './hooks';
import type { Permission, RoleWithPermissions } from '@/types';

export function RolesPermissionsPage() {
  const { t } = useTranslation();
  const rolesQuery = useRolesQuery();
  const permissionsQuery = usePermissionsQuery();
  const updatePermissions = useUpdateRolePermissions();

  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];

  const grouped = useMemo(() => {
    const map: Record<string, Permission[]> = {};
    for (const p of permissions) {
      const group = p.group ?? t('admin:rolesPermissionsPage.otherGroup');
      (map[group] ??= []).push(p);
    }
    return map;
  }, [permissions, t]);

  function togglePermission(role: RoleWithPermissions, permissionKey: string) {
    const has = role.permissionKeys.includes(permissionKey);
    const nextKeys = has ? role.permissionKeys.filter((k) => k !== permissionKey) : [...role.permissionKeys, permissionKey];
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
        <Card>
          <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-400">{t('admin:rolesPermissionsPage.hint')}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('admin:rolesPermissionsPage.permissionColumn')}
                  </th>
                  {roles.map((r) => (
                    <th key={r.id} className="min-w-[110px] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(grouped).map(([group, perms]) => (
                  <Fragment key={group}>
                    <tr className="bg-slate-50/70">
                      <td colSpan={roles.length + 1} className="px-4 py-1.5 text-xs font-semibold text-slate-500">
                        {group}
                      </td>
                    </tr>
                    {perms.map((p) => (
                      <tr key={p.key}>
                        <td className="sticky left-0 bg-white px-4 py-2.5 text-slate-700">{p.description ?? p.key}</td>
                        {roles.map((r) => (
                          <td key={r.id} className="px-4 py-2.5 text-center">
                            <Checkbox
                              checked={r.permissionKeys.includes(p.key)}
                              onChange={() => togglePermission(r, p.key)}
                              disabled={updatePermissions.isPending}
                              // 28/07/2026: them aria-label ket hop ten vai tro + quyen (phat hien qua ra soat kha
                              // nang tiep can) - truoc do trinh doc man hinh chi doc duoc "checkbox, chua chon",
                              // khong biet o nay dai dien cho vai tro/quyen nao, khien ca ma tran phan quyen khong
                              // the su dung neu khong nhin thay man hinh.
                              aria-label={t('admin:rolesPermissionsPage.checkboxAriaLabel', {
                                roleName: r.name,
                                permissionLabel: p.description ?? p.key,
                              })}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
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
