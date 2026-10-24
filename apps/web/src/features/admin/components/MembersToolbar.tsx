import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIcon } from '@/components/ui/Icons';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import type { Department } from '@/types';

interface MembersToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  selectedDept: string;
  onDeptChange: (val: string) => void;
  selectedStatus: string;
  onStatusChange: (val: string) => void;
  departments: Department[];
  isFiltering: boolean;
  onClearFilters: () => void;
}

export const MembersToolbar = memo(function MembersToolbar({
  search,
  onSearchChange,
  selectedDept,
  onDeptChange,
  selectedStatus,
  onStatusChange,
  departments,
  isFiltering,
  onClearFilters,
}: MembersToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-radius-md border border-border-subtle bg-white p-2.5">
      {/* Ô tìm kiếm theo tên hoặc email */}
      <div className="relative min-w-[240px] flex-1">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('admin:membersPage.searchPlaceholder')}
          className="h-9 w-full rounded-radius-sm border border-border-strong bg-white pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-tertiary transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Dropdown lọc theo Phòng ban */}
      <div className="w-full sm:w-[180px]">
        <CustomFilterSelect
          value={selectedDept}
          onChange={onDeptChange}
          ariaLabel={t('admin:membersPage.filterDepartmentAria')}
          options={[
            { value: '', label: t('admin:membersPage.allDepartments') },
            ...departments.map((d) => ({
              value: d.id,
              label: d.name,
            })),
          ]}
        />
      </div>

      {/* Dropdown lọc theo Trạng thái hoạt động */}
      <div className="w-full sm:w-[170px]">
        <CustomFilterSelect
          value={selectedStatus}
          onChange={onStatusChange}
          ariaLabel={t('admin:membersPage.filterStatusAria')}
          options={[
            { value: 'ALL', label: t('admin:membersPage.allStatuses') },
            { value: 'ACTIVE', label: t('admin:membersPage.status.active') },
            { value: 'INACTIVE', label: t('admin:membersPage.status.inactive') },
          ]}
        />
      </div>

      {isFiltering && (
        <button
          type="button"
          onClick={onClearFilters}
          className="text-[12px] font-medium text-text-secondary hover:text-text-primary px-2 py-1.5 rounded-radius-sm hover:bg-bg-subtle transition-colors cursor-pointer"
        >
          {t('admin:membersPage.clearFilters')}
        </button>
      )}
    </div>
  );
});

