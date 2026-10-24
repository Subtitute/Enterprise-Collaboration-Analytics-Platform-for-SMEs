import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export const Pagination = memo(function Pagination({ page, limit, total, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(total / Math.max(limit, 1)));
  if (totalPages <= 1) return null;

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row">
      <p className="text-xs text-slate-500">
        {t('common:pagination.showing', { from, to, total })}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          {t('common:pagination.previous')}
        </Button>
        <span className="text-xs text-slate-500">{t('common:pagination.pageOf', { page, totalPages })}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          {t('common:pagination.next')}
        </Button>
      </div>
    </div>
  );
});

