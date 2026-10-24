import React from 'react';
import { SearchIcon } from '@/components/ui/Icons';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';

export interface ProjectFilterToolbarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  priorityFilter: string;
  onPriorityChange: (value: string) => void;
  statusOptions: { value: string; label: string }[];
  priorityOptions: { value: string; label: string }[];
  searchPlaceholder: string;
  statusAllLabel: string;
  priorityAllLabel: string;
}

export const ProjectFilterToolbar = React.memo(function ProjectFilterToolbar({
  searchInput,
  onSearchInputChange,
  status,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  statusOptions,
  priorityOptions,
  searchPlaceholder,
  statusAllLabel,
  priorityAllLabel,
}: ProjectFilterToolbarProps) {
  return (
    /* 2. Toolbar - 1 hàng ngang (≥ lg 1 hàng, < lg search hàng trên, 2 select hàng dưới) */
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 mb-6">
      {/* 3.1 Search box flex-1, height 36 */}
      <div className="relative flex-1 min-w-0">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-9 w-full rounded-radius-sm border border-border-strong bg-white pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* 3.2 Status Select & 3.3 Priority Select - width 180 on lg, 2 cols on mobile */}
      <div className="grid grid-cols-2 lg:flex lg:items-center gap-2 shrink-0">
        <div className="w-full lg:w-[180px]">
          <CustomFilterSelect
            value={status}
            onChange={onStatusChange}
            ariaLabel={statusAllLabel}
            options={statusOptions}
          />
        </div>
        <div className="w-full lg:w-[180px]">
          <CustomFilterSelect
            value={priorityFilter}
            onChange={onPriorityChange}
            ariaLabel={priorityAllLabel}
            options={priorityOptions}
          />
        </div>
      </div>
    </div>
  );
});

