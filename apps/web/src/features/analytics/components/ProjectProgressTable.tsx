import { useMemo, useState } from 'react';
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

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Dự án' },
  { key: 'progress', label: 'Tiến độ' },
  { key: 'completedTasks', label: 'Hoàn thành' },
  { key: 'totalTasks', label: 'Tổng công việc' },
];

// Wireframe.md muc 7 yeu cau bang KPI vua sortable vua co phan trang. Toan bo du lieu da duoc
// tai het phia client (quy mo SME nho), nen phan trang o day chi la cat mang (slice) tren tap
// da sap xep, khong goi lai API - dung lai component Pagination dung chung.
const PAGE_SIZE = 10;

export function ProjectProgressTable({ rows }: { rows: ProjectProgressTableRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('progress');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

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
    return <EmptyState title="Chưa có dữ liệu để hiển thị" />;
  }

  return (
    <div>
      <p className="mb-2 text-xs text-slate-400">
        * Số liệu hiển thị theo toàn tổ chức. Phân tích theo phòng ban sẽ được bổ sung khi hệ thống hỗ trợ.
      </p>
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
              <TableCell label="Dự án" className="font-medium text-slate-800">
                {row.name}
              </TableCell>
              <TableCell label="Tiến độ" className="md:w-40">
                <ProgressBar value={row.progress} showLabel />
              </TableCell>
              <TableCell label="Hoàn thành">{row.completedTasks}</TableCell>
              <TableCell label="Tổng công việc">{row.totalTasks}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination page={currentPage} limit={PAGE_SIZE} total={sorted.length} onPageChange={setPage} />
    </div>
  );
}
