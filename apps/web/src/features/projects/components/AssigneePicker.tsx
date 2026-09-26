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
      panelClassName="w-64 p-1.5 rounded-md border border-slate-200/80 bg-white shadow-xl shadow-slate-900/10 space-y-1"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          disabled={isLoading}
          title={t('projects:assigneePicker.add')}
          aria-label={t('projects:assigneePicker.selectAriaLabel')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-slate-500 shadow-2xs transition-all duration-150 hover:border-primary-500 hover:bg-primary-50 hover:text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20 active:scale-95 shrink-0',
            open && 'border-primary-500 bg-primary-50 text-primary-600 ring-2 ring-primary-500/20',
          )}
        >
          {isLoading ? <Spinner size="sm" /> : <PlusIcon className="h-4 w-4" />}
        </button>
      )}
    >
      {({ close }) => (
        <div className="max-h-60 overflow-y-auto space-y-0.5">
          <div className="px-2.5 py-1.5 border-b border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {t('projects:taskDetail.assigneesLabel')}
            </p>
          </div>

          {isUsersLoading ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : candidates.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-400 text-center italic">
              {t('projects:assigneePicker.allAssigned')}
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
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition-colors duration-150 hover:bg-slate-50 group"
              >
                <Avatar name={u.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 truncate group-hover:text-primary-600 transition-colors">
                    {u.fullName}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                </div>
                <PlusIcon className="h-3.5 w-3.5 text-slate-300 group-hover:text-primary-600 transition-colors shrink-0" />
              </button>
            ))
          )}
        </div>
      )}
    </Dropdown>
  );
}
