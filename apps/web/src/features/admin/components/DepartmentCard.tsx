import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { EditIcon, MoreVerticalIcon, TrashIcon, UserIcon, UsersIcon } from '@/components/ui/Icons';
import type { Department } from '@/types';

interface DepartmentCardProps {
  department: Department;
  memberCount: number;
  managerName?: string;
  canManageDepartments: boolean;
  onEdit: (d: Department) => void;
  onDelete: (d: Department) => void;
}

export const DepartmentCard = memo(function DepartmentCard({
  department: d,
  memberCount,
  managerName,
  canManageDepartments,
  onEdit,
  onDelete,
}: DepartmentCardProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-radius-md border border-border-subtle bg-white p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-[15px] text-text-primary truncate">{d.name}</p>
          {d.description && (
            <p className="mt-0.5 text-[12px] text-text-tertiary line-clamp-2">{d.description}</p>
          )}
        </div>

        {canManageDepartments && (
          <Dropdown
            align="right"
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className="rounded-radius-sm p-1.5 text-text-tertiary hover:bg-bg-subtle hover:text-text-primary cursor-pointer transition-colors shrink-0"
                aria-label={t('admin:departmentsPage.optionsAria')}
              >
                <MoreVerticalIcon className="h-4 w-4" />
              </button>
            )}
          >
            {({ close }) => (
              <div className="w-40 py-1.5">
                <DropdownItem
                  onClick={() => {
                    onEdit(d);
                    close();
                  }}
                >
                  <EditIcon className="h-4 w-4" /> {t('admin:departmentsPage.actionsMenu.edit')}
                </DropdownItem>
                <DropdownItem
                  className="text-rose-600 hover:bg-rose-50 border-t border-border-subtle"
                  onClick={() => {
                    onDelete(d);
                    close();
                  }}
                >
                  <TrashIcon className="h-4 w-4" /> {t('admin:departmentsPage.actionsMenu.delete')}
                </DropdownItem>
              </div>
            )}
          </Dropdown>
        )}
      </div>

      <div className="mt-3.5 pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-radius-sm bg-bg-subtle border border-border-subtle px-2 py-0.5 text-[12px] font-medium font-mono tabular-nums text-text-primary">
            <UsersIcon className="h-3 w-3 text-text-secondary" />
            {t('admin:departmentsPage.membersCountLabel', { count: memberCount })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {d.managerId && managerName ? (
            <div className="flex items-center gap-1.5">
              <Avatar name={managerName} size="sm" className="h-6 w-6 text-[10px] bg-accent-soft text-accent" />
              <span className="text-[12px] font-medium text-text-primary truncate max-w-[120px]">{managerName}</span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-[12px] italic text-text-tertiary">
              <UserIcon className="h-3.5 w-3.5 text-text-tertiary" />
              {t('admin:departmentsPage.noManager')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

