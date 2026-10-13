import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/Input';
import { LockIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import type { Permission, RoleWithPermissions } from '@/types';
import { PERMISSION_META, isOrgAdminRole, formatRoleName } from '../roles-permissions.constants';

interface MobileRolesViewProps {
  roles: RoleWithPermissions[];
  groupedModules: Array<{ key: string; name: string; permissions: Permission[] }>;
  isPending: boolean;
  onTogglePermission: (role: RoleWithPermissions, permissionKey: string) => void;
  onToggleModule: (role: RoleWithPermissions, modulePerms: Permission[]) => void;
}

export const MobileRolesView = memo(function MobileRolesView({
  roles,
  groupedModules,
  isPending,
  onTogglePermission,
  onToggleModule,
}: MobileRolesViewProps) {
  const { t } = useTranslation();

  // Mặc định chọn vai trò có thể tùy chỉnh đầu tiên (ưu tiên Quản lý hoặc Nhân viên)
  const [selectedRoleId, setSelectedRoleId] = useState<string>(() => {
    const editableRole = roles.find((r) => !isOrgAdminRole(r.name));
    return editableRole ? editableRole.id : roles[0]?.id ?? '';
  });

  const selectedRole = useMemo(() => {
    return roles.find((r) => r.id === selectedRoleId) ?? roles[0];
  }, [roles, selectedRoleId]);

  if (!selectedRole) return null;

  const isLocked = isOrgAdminRole(selectedRole.name);

  return (
    <div className="space-y-4">
      {/* 1. Thanh chọn vai trò dạng Pill Tabs */}
      <div className="w-full overflow-x-auto no-scrollbar pb-1">
        <div className="inline-flex items-center gap-1.5 rounded-radius-md bg-bg-subtle p-1 border border-border-subtle whitespace-nowrap">
          {roles.map((r) => {
            const roleLocked = isOrgAdminRole(r.name);
            const isSelected = r.id === selectedRole.id;
            const roleLabel = formatRoleName(r.name, t);

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRoleId(r.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-[4px] transition-all cursor-pointer shrink-0',
                  isSelected
                    ? 'bg-white text-text-primary font-semibold shadow-xs border border-border-subtle'
                    : 'text-text-secondary hover:text-text-primary border border-transparent',
                )}
              >
                <span>{roleLabel}</span>
                {roleLocked && <LockIcon className="h-3 w-3 text-text-tertiary" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Banner giải thích vai trò đang chọn */}
      <div className="rounded-radius-md border border-border-subtle bg-white p-3.5 flex items-center justify-between gap-3 text-[13px]">
        <div>
          <span className="text-text-tertiary">Đang phân quyền cho: </span>
          <span className="font-semibold text-text-primary">{formatRoleName(selectedRole.name, t)}</span>
        </div>
        {isLocked ? (
          <span className="inline-flex items-center gap-1 rounded-radius-sm bg-bg-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary border border-border-subtle">
            <LockIcon className="h-3 w-3" /> Cố định
          </span>
        ) : (
          <span className="text-[12px] text-text-tertiary font-mono">
            {selectedRole.permissionKeys.length} quyền
          </span>
        )}
      </div>

      {/* 3. Danh sách nhóm quyền dạng Card Stack */}
      <div className="space-y-3">
        {groupedModules.map((mod) => {
          const modKeys = mod.permissions.map((p) => p.key);
          const hasAll = modKeys.length > 0 && modKeys.every((k) => selectedRole.permissionKeys.includes(k));
          const hasSome = modKeys.some((k) => selectedRole.permissionKeys.includes(k));

          return (
            <div
              key={mod.key}
              className="rounded-radius-md border border-border-subtle bg-white overflow-hidden transition-colors hover:border-border-strong"
            >
              {/* Header Module có nút Chọn tất cả */}
              <div className="flex items-center justify-between bg-bg-subtle/80 px-3.5 py-2.5 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-text-primary">{mod.name}</span>
                  <span className="rounded-full bg-border-subtle px-2 py-0.5 text-[10px] font-mono text-text-secondary">
                    {mod.permissions.length}
                  </span>
                </div>

                {!isLocked && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onToggleModule(selectedRole, mod.permissions)}
                    className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
                  >
                    {hasAll ? 'Bỏ chọn hết' : 'Chọn tất cả'}
                  </button>
                )}
              </div>

              {/* Danh sách các quyền con bên trong */}
              <div className="divide-y divide-border-subtle">
                {mod.permissions.map((p) => {
                  const meta = PERMISSION_META[p.key];
                  const safeKey = p.key.replace(':', '_');
                  const translationKey = `admin:rolesPermissionsPage.permissions.${safeKey}`;
                  const displayTitle = t(translationKey, { defaultValue: meta?.label ?? p.description ?? p.key });
                  const isChecked = isLocked ? true : selectedRole.permissionKeys.includes(p.key);

                  return (
                    <div
                      key={p.key}
                      onClick={() => !isLocked && !isPending && onTogglePermission(selectedRole, p.key)}
                      className={cn(
                        'flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors',
                        !isLocked ? 'cursor-pointer hover:bg-bg-subtle' : 'cursor-default',
                      )}
                    >
                      <span className="text-[13px] text-text-primary leading-snug flex-1">
                        {displayTitle}
                      </span>

                      <div className="shrink-0 flex items-center justify-center">
                        {isLocked ? (
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-[2px] border border-dashed border-border-strong bg-bg-muted cursor-not-allowed">
                            <LockIcon className="h-3 w-3 text-text-secondary" />
                          </span>
                        ) : (
                          <Checkbox
                            checked={isChecked}
                            onChange={() => onTogglePermission(selectedRole, p.key)}
                            disabled={isPending}
                            className="h-4 w-4 rounded-[2px] cursor-pointer"
                            aria-label={displayTitle}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

