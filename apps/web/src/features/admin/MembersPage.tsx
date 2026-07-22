import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EditIcon, MoreVerticalIcon, PlusIcon, RefreshIcon, UserIcon } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { useDeactivateUser, useDepartmentsQuery, useReactivateUser, useUsersQuery } from './hooks';
import { InviteMemberModal } from './components/InviteMemberModal';
import { EditMemberModal } from './components/EditMemberModal';
import type { User } from '@/types';

const LIMIT = 15;

export function MembersPage() {
  const [page, setPage] = useState(1);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);

  const usersQuery = useUsersQuery({ page, limit: LIMIT });
  const departmentsQuery = useDepartmentsQuery();
  const deactivateUser = useDeactivateUser();
  const reactivateUser = useReactivateUser();

  const departmentNameById: Record<string, string> = {};
  for (const d of departmentsQuery.data ?? []) departmentNameById[d.id] = d.name;

  const users = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta ?? { page: 1, limit: LIMIT, total: 0 };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Quản lý thành viên, phòng ban và phân quyền truy cập trong tổ chức.</p>
        <Button onClick={() => setIsInviteOpen(true)}>
          <PlusIcon className="h-4 w-4" /> Mời thành viên
        </Button>
      </div>

      <Card>
        <QueryState
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          onRetry={() => usersQuery.refetch()}
          loadingFallback={<FullPageSpinner label="Đang tải danh sách thành viên…" />}
          errorTitle="Không thể tải danh sách thành viên"
        >
        {users.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<UserIcon className="h-8 w-8" />} title="Chưa có thành viên nào" />
          </div>
        ) : (
          <>
            <Table>
              <TableHead>
                <tr>
                  <TableHeadCell>Thành viên</TableHeadCell>
                  <TableHeadCell>Phòng ban</TableHeadCell>
                  <TableHeadCell>Vai trò</TableHeadCell>
                  <TableHeadCell>Trạng thái</TableHeadCell>
                  <TableHeadCell className="text-right">Hành động</TableHeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell label="Thành viên">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{u.fullName}</p>
                          <p className="truncate text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell label="Phòng ban" className="text-sm text-slate-600">
                      {u.departmentId ? (departmentNameById[u.departmentId] ?? '—') : '—'}
                    </TableCell>
                    <TableCell label="Vai trò">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles ?? []).length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          (u.roles ?? []).map((r) => (
                            <Badge key={r.id} variant="outline">
                              {r.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell label="Trạng thái">
                      <Badge variant={u.isActive === false ? 'danger' : 'success'}>
                        {u.isActive === false ? 'Đã vô hiệu hoá' : 'Đang hoạt động'}
                      </Badge>
                    </TableCell>
                    <TableCell label="Hành động" className="text-right">
                      <Dropdown
                        align="right"
                        trigger={({ toggle }) => (
                          <button onClick={toggle} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Tùy chọn thành viên">
                            <MoreVerticalIcon className="h-4 w-4" />
                          </button>
                        )}
                      >
                        {({ close }) => (
                          <div className="w-48 py-1.5">
                            <DropdownItem
                              onClick={() => {
                                setEditingUser(u);
                                close();
                              }}
                            >
                              <EditIcon className="h-4 w-4" /> Đổi phòng ban / vai trò
                            </DropdownItem>
                            {u.isActive !== false ? (
                              <DropdownItem
                                className="text-rose-600 hover:bg-rose-50"
                                onClick={() => {
                                  setDeactivatingUser(u);
                                  close();
                                }}
                              >
                                <UserIcon className="h-4 w-4" /> Vô hiệu hoá
                              </DropdownItem>
                            ) : (
                              // 22/07/2026 (review toan du an): truoc day KHONG co cach nao kich
                              // hoat lai 1 tai khoan da vo hieu hoa tu giao dien - backend da bo
                              // sung PATCH /users/:id/reactivate (fix loi Major) nhung thieu diem
                              // vao tu UI. Chi hien khi tai khoan dang bi vo hieu hoa.
                              <DropdownItem
                                onClick={() => {
                                  reactivateUser.mutate(u.id);
                                  close();
                                }}
                              >
                                <RefreshIcon className="h-4 w-4" /> Kích hoạt lại
                              </DropdownItem>
                            )}
                          </div>
                        )}
                      </Dropdown>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={meta.page} limit={meta.limit} total={meta.total} onPageChange={setPage} />
          </>
        )}
        </QueryState>
      </Card>

      <InviteMemberModal open={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
      <EditMemberModal user={editingUser} onClose={() => setEditingUser(null)} />
      <ConfirmDialog
        open={Boolean(deactivatingUser)}
        onClose={() => setDeactivatingUser(null)}
        onConfirm={() => {
          if (deactivatingUser) deactivateUser.mutate(deactivatingUser.id);
          setDeactivatingUser(null);
        }}
        title="Vô hiệu hoá tài khoản này?"
        description={deactivatingUser ? `"${deactivatingUser.fullName}" sẽ không thể đăng nhập cho đến khi được kích hoạt lại.` : undefined}
        confirmLabel="Vô hiệu hoá"
        danger
      />
    </div>
  );
}
