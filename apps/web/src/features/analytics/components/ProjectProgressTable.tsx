import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { ChevronDownIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import type { ProjectProgressRow } from './ProjectProgressChart';

type SortKey = 'name' | 'progress' | 'completedTasks' | 'totalTasks' | 'deadline';

export interface ProjectProgressTableRow extends ProjectProgressRow {
  completedTasks: number;
  totalTasks: number;
  deadline?: string;
}

// Wireframe.md muc 7 yeu cau bang KPI vua sortable vua co phan trang. Toan bo du lieu da duoc
// tai het phia client (quy mo SME nho), nen phan trang o day chi la cat mang (slice) tren tap
// da sap xep, khong goi lai API - dung lai component Pagination dung chung.
const PAGE_SIZE = 10;

const ProjectProgressTableRowComponent = React.memo(function ProjectProgressTableRowComponent({
  row,
  onNavigate,
}: {
  row: ProjectProgressTableRow;
  onNavigate: (projectId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <TableRow className="h-14 hover:bg-bg-subtle transition-colors border-b border-border-subtle">
      <TableCell label={t('analytics:projectProgressTable.columns.name')}>
        <span
          onClick={() => onNavigate(row.projectId)}
          className="font-medium text-text-primary hover:text-accent cursor-pointer transition-colors"
          title={row.name}
        >
          {row.name}
        </span>
      </TableCell>
      <TableCell label={t('analytics:projectProgressTable.columns.progress')} className="md:w-44">
        <div
          role="progressbar"
          aria-valuenow={Math.max(0, Math.min(100, Math.round(row.progress || 0)))}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('common:progress')}
          className="flex items-center gap-2"
        >
          <div className="h-1.5 w-full flex-1 overflow-hidden rounded-full bg-bg-subtle">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                row.progress >= 100 ? 'bg-success' : 'bg-accent'
              )}
              style={{ width: `${Math.max(0, Math.min(100, Math.round(row.progress || 0)))}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-[13px] font-medium text-text-primary tabular-nums">
            {Math.max(0, Math.min(100, Math.round(row.progress || 0)))}%
          </span>
        </div>
      </TableCell>
      <TableCell label={t('analytics:projectProgressTable.columns.completedTasks')} className="text-right">
        <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">
          {row.completedTasks}
        </span>
      </TableCell>
      <TableCell label={t('analytics:projectProgressTable.columns.totalTasks')} className="text-right">
        <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">
          {row.totalTasks}
        </span>
      </TableCell>
      <TableCell label={t('analytics:projectProgressTable.columns.deadline')}>
        <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">
          {row.deadline || '—'}
        </span>
      </TableCell>
    </TableRow>
  );
});

export const ProjectProgressTable = React.memo(function ProjectProgressTable({
  rows,
}: {
  rows: ProjectProgressTableRow[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('progress');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const handleNavigate = useCallback(
    (projectId: string) => navigate(`/projects/${projectId}`),
    [navigate],
  );

  const columns: { key: SortKey; label: string; align?: 'left' | 'right' }[] = useMemo(
    () => [
      { key: 'name', label: t('analytics:projectProgressTable.columns.name'), align: 'left' },
      { key: 'progress', label: t('analytics:projectProgressTable.columns.progress'), align: 'left' },
      { key: 'completedTasks', label: t('analytics:projectProgressTable.columns.completedTasks'), align: 'right' },
      { key: 'totalTasks', label: t('analytics:projectProgressTable.columns.totalTasks'), align: 'right' },
      { key: 'deadline', label: t('analytics:projectProgressTable.columns.deadline'), align: 'left' },
    ],
    [t],
  );

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sorted, currentPage],
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  }

  if (rows.length === 0) {
    return <EmptyState title={t('analytics:projectProgressTable.emptyTitle')} />;
  }

  return (
    <div>
      <Table>
        <TableHead>
          <tr className="h-10 bg-bg-subtle">
            {columns.map((col) => (
              <TableHeadCell key={col.key} className={cn('text-[12px] font-medium text-text-tertiary uppercase tracking-wider', col.align === 'right' ? 'text-right' : 'text-left')}>
                <button
                  onClick={() => toggleSort(col.key)}
                  className={cn(
                    'inline-flex items-center gap-1 hover:text-text-primary',
                    col.align === 'right' && 'justify-end w-full'
                  )}
                >
                  {col.label}
                  <ChevronDownIcon
                    className={cn(
                      'h-3 w-3 transition-transform shrink-0',
                      sortKey === col.key ? 'text-text-primary' : 'text-text-tertiary',
                      sortKey === col.key && sortDir === 'asc' && 'rotate-180',
                    )}
                  />
                </button>
              </TableHeadCell>
            ))}
          </tr>
        </TableHead>
        <TableBody>
          {paginated.map((row) => (
            <ProjectProgressTableRowComponent
              key={row.projectId}
              row={row}
              onNavigate={handleNavigate}
            />
          ))}
        </TableBody>
      </Table>
      <Pagination page={currentPage} limit={PAGE_SIZE} total={sorted.length} onPageChange={setPage} />
    </div>
  );
});
