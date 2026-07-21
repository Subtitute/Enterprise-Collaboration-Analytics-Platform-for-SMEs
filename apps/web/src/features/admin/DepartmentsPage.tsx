import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { BuildingIcon, EditIcon, MoreVerticalIcon, PlusIcon, TrashIcon } from '@/components/ui/Icons';
import { useDeleteDepartment, useDepartmentsQuery } from './hooks';
import { DepartmentModal } from './components/DepartmentModal';
import type { Department } from '@/types';

export function DepartmentsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);

  const departmentsQuery = useDepartmentsQuery();
  const deleteDepartment = useDeleteDepartment();
  const departments = departmentsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Quản lý cơ cấu phòng ban trong tổ chức.</p>
        <Button onClick={() => setIsCreateOpen(true)}>
          <PlusIcon className="h-4 w-4" /> Phòng ban mới
        </Button>
      </div>

      <Card>
        <QueryState
          isLoading={departmentsQuery.isLoading}
          isError={departmentsQuery.isError}
          onRetry={() => departmentsQuery.refetch()}
          loadingFallback={<FullPageSpinner label="Đang tải phòng ban…" />}
          errorTitle="Không thể tải danh sách phòng ban"
        >
        {departments.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<BuildingIcon className="h-8 w-8" />} title="Chưa có phòng ban nào" />
          </div>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableHeadCell>Tên phòng ban</TableHeadCell>
                <TableHeadCell>Mô tả</TableHeadCell>
                {departments.some((d) => d.memberCount !== undefined) && <TableHeadCell>Số thành viên</TableHeadCell>}
                <TableHeadCell className="text-right">Hành động</TableHeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell label="Tên phòng ban" className="font-medium text-slate-800">
                    {d.name}
                  </TableCell>
                  <TableCell label="Mô tả" className="text-sm text-slate-500">
                    {d.description || '—'}
                  </TableCell>
                  {departments.some((x) => x.memberCount !== undefined) && (
                    <TableCell label="Số thành viên">{d.memberCount ?? '—'}</TableCell>
                  )}
                  <TableCell label="Hành động" className="text-right">
                    <Dropdown
                      align="right"
                      trigger={({ toggle }) => (
                        <button onClick={toggle} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Tùy chọn phòng ban">
                          <MoreVerticalIcon className="h-4 w-4" />
                        </button>
                      )}
                    >
                      {({ close }) => (
                        <div className="w-40 py-1.5">
                          <DropdownItem
                            onClick={() => {
                              setEditingDept(d);
                              close();
                            }}
                          >
                            <EditIcon className="h-4 w-4" /> Chỉnh sửa
                          </DropdownItem>
                          <DropdownItem
                            className="text-rose-600 hover:bg-rose-50"
                            onClick={() => {
                              setDeletingDept(d);
                              close();
                            }}
                          >
                            <TrashIcon className="h-4 w-4" /> Xoá
                          </DropdownItem>
                        </div>
                      )}
                    </Dropdown>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        </QueryState>
      </Card>

      <DepartmentModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <DepartmentModal open={Boolean(editingDept)} onClose={() => setEditingDept(null)} department={editingDept} />
      <ConfirmDialog
        open={Boolean(deletingDept)}
        onClose={() => setDeletingDept(null)}
        onConfirm={() => {
          if (deletingDept) deleteDepartment.mutate(deletingDept.id);
          setDeletingDept(null);
        }}
        title="Xoá phòng ban này?"
        description={deletingDept ? `Thành viên thuộc "${deletingDept.name}" sẽ không còn thuộc phòng ban nào.` : undefined}
        confirmLabel="Xoá phòng ban"
        danger
      />
    </div>
  );
}
