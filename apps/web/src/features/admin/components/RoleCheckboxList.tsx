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
              'group relative flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer transition-all duration-200 select-none shadow-2xs',
              isSelected
                ? 'border-indigo-500/80 bg-indigo-50/40 ring-1 ring-indigo-500/20 shadow-xs'
                : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/60',
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                  isSelected
                    ? 'border-indigo-200 bg-indigo-100/70 text-indigo-700'
                    : 'border-slate-200/80 bg-slate-50 text-slate-500 group-hover:text-slate-700',
                )}
              >
                <ShieldIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <span
                  className={cn(
                    'block text-xs font-bold leading-tight transition-colors truncate',
                    isSelected ? 'text-indigo-950' : 'text-slate-800',
                  )}
                >
                  {roleLabel}
                </span>
                <span className="block text-[11px] text-slate-400 truncate mt-0.5">
                  {role.name !== roleLabel ? role.name : t('admin:rolesPermissionsPage.groups.iam')}
                </span>
              </div>
            </div>

            {/* Custom Checkbox indicator */}
            <div
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-150',
                isSelected
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                  : 'border-slate-300 bg-white group-hover:border-slate-400',
              )}
            >
              {isSelected && <CheckIcon className="h-3.5 w-3.5 stroke-[2.5]" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
