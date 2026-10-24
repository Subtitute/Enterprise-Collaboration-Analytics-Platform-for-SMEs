import React from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIcon, GridIcon, ListIcon } from '@/components/ui/Icons';

interface DocumentFilterToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

/**
 * Hàng 2: Toolbar 1 hàng ngang (§2.2: [Search flex-1] [Grid/List Segmented Control])
 */
export const DocumentFilterToolbar = React.memo(function DocumentFilterToolbar({
  searchTerm,
  onSearchChange,
  onClearSearch,
  viewMode,
  onViewModeChange,
}: DocumentFilterToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      {/* Ô tìm kiếm tài liệu & thư mục flex-1 */}
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary stroke-1.5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('documents:documentsPage.searchPlaceholder')}
          className="h-9 w-full rounded-radius-sm border border-border-strong bg-white pl-9 pr-8 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={onClearSearch}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-text-tertiary hover:text-text-primary text-[12px]"
          >
            ✕
          </button>
        )}
      </div>

      {/* Cụm nút chuyển chế độ xem (Segmented Control căn phải) */}
      <div className="flex h-9 items-center rounded-radius-md bg-bg-subtle p-0.5 gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onViewModeChange('grid')}
          className={`flex h-8 items-center gap-1.5 rounded-radius-sm px-3 text-[12px] transition-colors cursor-pointer select-none ${
            viewMode === 'grid'
              ? 'bg-white border border-border-subtle text-[#1C1B1A] font-semibold shadow-xs'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-canvas font-medium'
          }`}
          title={t('documents:documentsPage.viewMode.gridTitle')}
        >
          <GridIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('documents:documentsPage.viewMode.grid')}</span>
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('list')}
          className={`flex h-8 items-center gap-1.5 rounded-radius-sm px-3 text-[12px] transition-colors cursor-pointer select-none ${
            viewMode === 'list'
              ? 'bg-white border border-border-subtle text-[#1C1B1A] font-semibold shadow-xs'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-canvas font-medium'
          }`}
          title={t('documents:documentsPage.viewMode.listTitle')}
        >
          <ListIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('documents:documentsPage.viewMode.list')}</span>
        </button>
      </div>
    </div>
  );
});

