import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { ChevronDownIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import type { ProjectProgressRow } from './ProjectProgressChart';

type SortKey = 'name' | 'progress' | 'completedTasks' | 'totalTasks';

export interface ProjectProgressTableRow extends ProjectProgressRow {
  completedTasks: number;
  totalTasks: number;
}

// Wireframe.md muc 7 yeu cau bang KPI vua sortable vua co phan trang. Toan bo du lieu da duoc
// tai het phia client (quy mo SME nho), nen phan trang o day chi la cat mang (slice) tren tap
// da sap xep, khong goi lai API - dung lai component Pagination dung chung.
const PAGE_SIZE = 10;

export function ProjectProgressTable({ rows }: { rows: ProjectProgressTableRow[] }) {
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState<SortKey>('progress');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const COLUMNS: { key: SortKey; label: string }[] = [
    { key: 'name', label: t('analytics:projectProgressTable.columns.name') },
    { key: 'progress', label: t('analytics:projectProgressTable.columns.progress') },
    { key: 'completedTasks', label: t('analytics:projectProgressTable.columns.completedTasks') },
    { key: 'totalTasks', label: t('analytics:projectProgressTable.columns.totalTasks') },
  ];

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
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
      <p className="mb-2 text-xs text-slate-400">{t('analytics:projectProgressTable.footnote')}</p>
      <Table>
        <TableHead>
          <tr>
            {COLUMNS.map((col) => (
              <TableHeadCell key={col.key}>
                <button onClick={() => toggleSort(col.key)} className="flex items-center gap-1 hover:text-slate-700">
                  {col.label}
                  <ChevronDownIcon
                    className={cn(
                      'h-3 w-3 transition-transform',
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
              <TableCell label={t('analytics:projectProgressTable.columns.name')} className="font-medium text-slate-800">
                {row.name}
              </TableCell>
              <TableCell label={t('analytics:projectProgressTable.columns.progress')} className="md:w-40">
                <ProgressBar value={row.progress} showLabel />
              </TableCell>
              <TableCell label={t('analytics:projectProgressTable.columns.completedTasks')}>{row.completedTasks}</TableCell>
              <TableCell label={t('analytics:projectProgressTable.columns.totalTasks')}>{row.totalTasks}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination page={currentPage} limit={PAGE_SIZE} total={sorted.length} onPageChange={setPage} />
    </div>
  );
}
