import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { CheckIcon, ShieldIcon } from '@/components/ui/Icons';
import type { Role } from '@/types';

export function RoleCheckboxList({
  roles,
  selectedIds,
  onChange,
}: {
  roles: Role[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id]);
  }

  if (roles.length === 0) {
    return <p className="text-xs text-slate-400">{t('admin:roleCheckboxList.empty')}</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {roles.map((role) => {
        const isSelected = selectedIds.includes(role.id);
        const lower = role.name.trim().toLowerCase();
        // 16/09/2026: bo cac nhanh khop tieng Viet ('quản trị'/'quản lý'/'nhân viên') - Role.name
        // luon la tieng Anh ('Org Admin'/'Manager'/'Employee', xem DefaultRoleName trong
        // packages/common-dto), khong co endpoint doi ten vai tro nao ca nen cac nhanh nay khong
        // bao gio khop (dead code) va vi pham linter hardcode tieng Viet.
        const isAdmin = lower.includes('admin');
        const isManager = lower.includes('manager');
        const isEmployee = lower.includes('employee');
        const roleLabel = isAdmin
          ? t('admin:roles.orgAdmin')
          : isManager
          ? t('admin:roles.manager')
          : isEmployee
          ? t('admin:roles.employee')
          : role.name;

        return (
          <div
            key={role.id}
            onClick={() => toggle(role.id)}
            className={cn(
              'group relative flex items-center justify-between gap-3 rounded-radius-md border p-3 cursor-pointer transition-all duration-200 select-none',
              isSelected
                ? 'border-accent bg-accent-soft/30 ring-1 ring-accent'
                : 'border-border-subtle bg-white hover:border-border-strong hover:bg-bg-subtle',
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-radius-sm border transition-colors',
                  isSelected
                    ? 'border-accent/20 bg-accent-soft text-accent'
                    : 'border-border-subtle bg-bg-subtle text-text-secondary group-hover:text-text-primary',
                )}
              >
                <ShieldIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <span
                  className={cn(
                    'block text-[13px] font-semibold leading-tight transition-colors truncate',
                    isSelected ? 'text-text-primary' : 'text-text-secondary',
                  )}
                >
                  {roleLabel}
                </span>
                <span className="block text-[11px] text-text-tertiary truncate mt-0.5">
                  {role.name !== roleLabel ? role.name : t('admin:rolesPermissionsPage.groups.iam')}
                </span>
              </div>
            </div>

            {/* Custom Checkbox indicator */}
            <div
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border transition-all duration-150',
                isSelected
                  ? 'border-text-primary bg-text-primary text-white'
                  : 'border-border-strong bg-white group-hover:border-text-secondary',
              )}
            >
              {isSelected && <CheckIcon className="h-3 w-3 stroke-[2.5]" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
