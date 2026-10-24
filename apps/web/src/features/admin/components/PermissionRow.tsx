import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/Input';
import { LockIcon } from '@/components/ui/Icons';
import type { Permission, RoleWithPermissions } from '@/types';
import { PERMISSION_META, isOrgAdminRole } from '../roles-permissions.constants';

interface PermissionRowProps {
  permission: Permission;
  roles: RoleWithPermissions[];
  isPending: boolean;
  onToggle: (role: RoleWithPermissions, permissionKey: string) => void;
}

export const PermissionRow = memo(function PermissionRow({
  permission: p,
  roles,
  isPending,
  onToggle,
}: PermissionRowProps) {
  const { t } = useTranslation();
  const meta = PERMISSION_META[p.key];
  const safeKey = p.key.replace(':', '_');
  const translationKey = `admin:rolesPermissionsPage.permissions.${safeKey}`;
  const displayTitle = t(translationKey, { defaultValue: meta?.label ?? p.description ?? p.key });

  return (
    <tr className="border-b border-border-subtle hover:bg-bg-subtle transition-colors">
      <td className="md:sticky md:left-0 md:z-10 bg-white px-3 sm:px-5 py-3">
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
                  onChange={() => onToggle(r, p.key)}
                  disabled={isPending}
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
});

