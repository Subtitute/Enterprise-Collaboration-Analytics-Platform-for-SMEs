import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown } from '@/components/ui/Dropdown';
import { Avatar } from '@/components/ui/Avatar';
import { PlusIcon, CheckIcon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Spinner';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import { cn } from '@/lib/utils';
import type { TaskAssignee } from '@/types';

export function AssigneePicker({
  currentAssignees,
  onAdd,
  isLoading,
}: {
  currentAssignees: TaskAssignee[];
  onAdd: (userId: string) => void;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const { data: users, isLoading: isUsersLoading } = useOrgUsersQuery();
  const assignedIds = new Set(currentAssignees.map((a) => a.userId));
  const candidates = (users ?? []).filter((u) => !assignedIds.has(u.id));

  return (
    <Dropdown
      align="right"
      panelClassName="w-64 p-1.5 rounded-radius-md border border-border-subtle bg-white shadow-lg space-y-1"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          disabled={isLoading}
          title={t('projects:assigneePicker.add')}
          aria-label={t('projects:assigneePicker.selectAriaLabel')}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-border-strong bg-white text-text-tertiary transition-colors hover:border-accent hover:text-accent focus:outline-none focus:ring-1 focus:ring-accent shrink-0 cursor-pointer',
            open && 'border-accent text-accent ring-1 ring-accent',
          )}
        >
          {isLoading ? <Spinner size="sm" /> : <PlusIcon className="h-3.5 w-3.5 stroke-1.5" />}
        </button>
      )}
    >
      {({ close }) => (
        <div className="max-h-60 overflow-y-auto space-y-0.5">
          <div className="px-2.5 py-1.5 border-b border-border-subtle">
            <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider leading-none">
              {t('projects:taskDetail.assigneesLabel', 'Người phụ trách')}
            </p>
          </div>

          {isUsersLoading ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : candidates.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-text-tertiary text-center italic">
              {t('projects:assigneePicker.allAssigned', 'Đã phân công tất cả')}
            </p>
          ) : (
            candidates.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onAdd(u.id);
                  close();
                }}
                className="flex w-full items-center gap-2.5 rounded-radius-sm px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-bg-subtle group cursor-pointer"
              >
                <Avatar name={u.fullName} size="sm" className="h-5 w-5 text-[10px] rounded-full bg-accent-soft text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary truncate">
                    {u.fullName}
                  </p>
                  <p className="text-[10px] text-text-tertiary truncate">{u.email}</p>
                </div>
                <PlusIcon className="h-3.5 w-3.5 text-text-tertiary group-hover:text-accent transition-colors shrink-0" />
              </button>
            ))
          )}
        </div>
      )}
    </Dropdown>
  );
}
