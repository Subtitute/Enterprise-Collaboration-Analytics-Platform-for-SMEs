import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { ProgressBar } from '@/components/ui/ProgressBar';
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

export function ProjectProgressTable({ rows }: { rows: ProjectProgressTableRow[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('progress');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const COLUMNS: { key: SortKey; label: string; align?: 'left' | 'right' }[] = [
    { key: 'name', label: t('analytics:projectProgressTable.columns.name'), align: 'left' },
    { key: 'progress', label: t('analytics:projectProgressTable.columns.progress'), align: 'left' },
    { key: 'completedTasks', label: t('analytics:projectProgressTable.columns.completedTasks'), align: 'right' },
    { key: 'totalTasks', label: t('analytics:projectProgressTable.columns.totalTasks'), align: 'right' },
    { key: 'deadline', label: t('analytics:projectProgressTable.columns.deadline'), align: 'left' },
  ];

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
          <tr>
            {COLUMNS.map((col) => (
              <TableHeadCell key={col.key} className={col.align === 'right' ? 'text-right' : 'text-left'}>
                <button
                  onClick={() => toggleSort(col.key)}
                  className={cn(
                    'inline-flex items-center gap-1 hover:text-slate-700',
                    col.align === 'right' && 'justify-end w-full'
                  )}
                >
                  {col.label}
                  <ChevronDownIcon
                    className={cn(
                      'h-3 w-3 transition-transform shrink-0',
                      sortKey === col.key ? 'text-slate-600' : 'text-slate-300',
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
            <TableRow key={row.projectId}>
              <TableCell label={t('analytics:projectProgressTable.columns.name')}>
                <span
                  onClick={() => navigate(`/projects/${row.projectId}`)}
                  className="font-medium text-slate-800 hover:text-indigo-600 cursor-pointer transition-colors"
                  title={row.name}
                >
                  {row.name}
                </span>
              </TableCell>
              <TableCell label={t('analytics:projectProgressTable.columns.progress')} className="md:w-40">
                <ProgressBar value={row.progress} showLabel />
              </TableCell>
              <TableCell label={t('analytics:projectProgressTable.columns.completedTasks')} className="text-right font-medium tabular-nums">
                {row.completedTasks}
              </TableCell>
              <TableCell label={t('analytics:projectProgressTable.columns.totalTasks')} className="text-right font-medium tabular-nums">
                {row.totalTasks}
              </TableCell>
              <TableCell label={t('analytics:projectProgressTable.columns.deadline')} className="text-slate-500 text-xs">
                {row.deadline || '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination page={currentPage} limit={PAGE_SIZE} total={sorted.length} onPageChange={setPage} />
    </div>
  );
}
