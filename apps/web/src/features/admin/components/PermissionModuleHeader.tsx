import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { LockIcon } from '@/components/ui/Icons';
import type { Permission, RoleWithPermissions } from '@/types';
import { isOrgAdminRole } from '../roles-permissions.constants';

interface PermissionModuleHeaderProps {
  moduleName: string;
  modulePermissions: Permission[];
  roles: RoleWithPermissions[];
  isPending: boolean;
  isFirst: boolean;
  onToggleModule: (role: RoleWithPermissions, modulePerms: Permission[]) => void;
}

export const PermissionModuleHeader = memo(function PermissionModuleHeader({
  moduleName,
  modulePermissions,
  roles,
  isPending,
  isFirst,
  onToggleModule,
}: PermissionModuleHeaderProps) {
  const { t } = useTranslation();

  return (
    <tr className={`border-y border-border-subtle bg-bg-subtle/80 ${!isFirst ? 'border-t-2 border-t-border-subtle' : ''}`}>
      <td className="md:sticky md:left-0 md:z-10 bg-bg-subtle px-3 sm:px-5 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-text-primary tracking-wide">
            {moduleName}
          </span>
          <span className="inline-flex items-center rounded-full bg-border-subtle px-2 py-0.5 text-[11px] font-medium text-text-secondary font-mono tabular-nums">
            {modulePermissions.length}
          </span>
        </div>
      </td>

      {/* Các ô chọn hàng loạt cho từng vai trò trong module này */}
      {roles.map((r) => {
        const isLocked = isOrgAdminRole(r.name);
        const modKeys = modulePermissions.map((p) => p.key);
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
                  onClick={() => onToggleModule(r, modulePermissions)}
                  disabled={isPending}
                  title={t('admin:rolesPermissionsPage.selectAllModule')}
                  aria-label={t('admin:rolesPermissionsPage.moduleSelectAllAria', {
                    roleName: r.name,
                    groupName: moduleName,
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
  );
});

