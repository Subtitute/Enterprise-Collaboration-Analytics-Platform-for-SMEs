import React from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIcon, GridIcon, ListIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface CrmFilterToolbarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  viewMode: 'grid' | 'table';
  onViewModeChange: (mode: 'grid' | 'table') => void;
}

export const CrmFilterToolbar = React.memo(function CrmFilterToolbar({
  searchInput,
  onSearchChange,
  viewMode,
  onViewModeChange,
}: CrmFilterToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary stroke-1.5" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('crm:customersListPage.searchPlaceholder', 'Tìm kiếm khách hàng...')}
          aria-label={t('crm:customersListPage.searchPlaceholder', 'Tìm kiếm khách hàng...')}
          className="h-9 w-full rounded-radius-sm border border-border-strong bg-white pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />
      </div>

      <div className="flex items-center rounded-radius-sm border border-border-subtle bg-white p-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onViewModeChange('grid')}
          title={t('crm:customersListPage.viewGrid', 'Hiển thị dạng thẻ')}
          aria-label={t('crm:customersListPage.viewGrid', 'Hiển thị dạng thẻ')}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-radius-xs transition-colors cursor-pointer',
            viewMode === 'grid'
              ? 'bg-bg-subtle text-text-primary shadow-xs'
              : 'text-text-tertiary hover:text-text-primary'
          )}
        >
          <GridIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('table')}
          title={t('crm:customersListPage.viewTable', 'Hiển thị dạng bảng')}
          aria-label={t('crm:customersListPage.viewTable', 'Hiển thị dạng bảng')}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-radius-xs transition-colors cursor-pointer',
            viewMode === 'table'
              ? 'bg-bg-subtle text-text-primary shadow-xs'
              : 'text-text-tertiary hover:text-text-primary'
          )}
        >
          <ListIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

