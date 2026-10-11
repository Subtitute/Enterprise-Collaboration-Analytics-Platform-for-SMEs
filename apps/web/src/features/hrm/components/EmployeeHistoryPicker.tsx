import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown } from '@/components/ui/Dropdown';
import { SearchIcon, ChevronDownIcon } from '@/components/ui/Icons';
import type { User } from '@/types';

/**
 * 2.7 Employee picker dropdown
 * Trigger: input icon search trái, label 'Xem lịch sử theo nhân viên' 13/400 text-secondary, chevron-down 12px right. Border 1 border-strong, radius 6 (radius-sm), h36.
 * Panel: shadow-sm, radius 6, padding 4, min-w 280.
 * Item: h44, padding 8x10, radius 4, hover bg-subtle, Avatar 28x28 #E4EFEE + #0E5E5E, Tên 13/500 text-primary, email 12/400 text-tertiary.
 */
export function EmployeeHistoryPicker({ users, onSelect }: { users: User[]; onSelect: (userId: string) => void }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="w-full">
      <Dropdown
        align="left"
        panelClassName="min-w-[280px] p-1 rounded-radius-sm border border-border-subtle bg-white shadow-sm"
        trigger={({ toggle }) => (
          <button
            type="button"
            onClick={toggle}
            className="flex h-9 w-full items-center justify-between gap-2 rounded-radius-sm border border-border-strong px-3 text-left text-[13px] font-normal text-text-secondary hover:border-text-primary hover:bg-bg-subtle transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 truncate">
              <SearchIcon className="h-4 w-4 text-text-tertiary shrink-0" />
              <span className="truncate">{t('hrm:employeePicker.label')}</span>
            </span>
            <ChevronDownIcon className="h-3 w-3 text-text-tertiary shrink-0" />
          </button>
        )}
      >
        {({ close }) => (
          <div className="space-y-1.5 p-1">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('hrm:employeePicker.searchPlaceholder')}
              className="h-8 w-full rounded-radius-sm border border-border-strong bg-white px-2.5 text-[12px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
            <div className="max-h-60 space-y-0.5 overflow-y-auto popover-scrollbar">
              {filteredUsers.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-text-tertiary">{t('hrm:employeePicker.emptyResult')}</p>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onSelect(u.id);
                      close();
                    }}
                    className="flex h-11 w-full items-center gap-2.5 rounded-radius-xs px-2.5 py-2 text-left transition-colors duration-150 hover:bg-bg-subtle cursor-pointer"
                  >
                    <Avatar name={u.fullName} className="h-7 w-7 text-[11px] bg-[#E4EFEE] text-[#0E5E5E] shrink-0 font-semibold" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-text-primary">{u.fullName}</p>
                      <p className="truncate text-[12px] text-text-tertiary">{u.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </Dropdown>
    </div>
  );
}

