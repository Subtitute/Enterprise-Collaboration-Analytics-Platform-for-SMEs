import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
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

export function ProjectProgressTable({ rows }: { rows: ProjectProgressTableRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('progress');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
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
          {sorted.map((row) => (
            <TableRow key={row.projectId}>
              <TableCell className="font-medium text-slate-800">{row.name}</TableCell>
              <TableCell className="w-40">
                <ProgressBar value={row.progress} showLabel />
              </TableCell>
              <TableCell>{row.completedTasks}</TableCell>
              <TableCell>{row.totalTasks}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
