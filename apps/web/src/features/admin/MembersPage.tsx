import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/stores/auth.store';
import { Table, TableBody, TableHead, TableHeadCell } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { PlusIcon, SearchIcon, UploadIcon, UserIcon } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { useDeactivateUser, useDeleteUser, useDepartmentsQuery, useReactivateUser, useUsersQuery } from './hooks';
import { InviteMemberModal } from './components/InviteMemberModal';
import { ImportEmployeesModal } from './components/ImportEmployeesModal';
import { EditMemberModal } from './components/EditMemberModal';
import { MemberTableRow } from './components/MemberTableRow';
import { MemberCard } from './components/MemberCard';
import { MembersToolbar } from './components/MembersToolbar';
import type { User } from '@/types';

const LIMIT = 15;

export function MembersPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // Bộ lọc nhanh (Toolbar)
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const usersQuery = useUsersQuery({ page, limit: LIMIT });
  const departmentsQuery = useDepartmentsQuery();
  const deactivateUser = useDeactivateUser();
  const reactivateUser = useReactivateUser();
  const deleteUser = useDeleteUser();
  // 17/09/2026: Manager gio cung vao duoc trang nay (co USER_INVITE, xem canAccessAdminArea/
  // AdminPage.tsx) nhung KHONG co USER_MANAGE - an (khong chi disable) cac hanh dong sua vai
  // tro/phong ban, vo hieu hoa, kich hoat lai, giu nguyen nut "Moi thanh vien" (chi can USER_INVITE
  // ma ca Manager lan Org Admin deu co, xem DEFAULT_ROLE_PERMISSIONS trong packages/common-dto).
  const permissions = usePermissions();
  const canManageUsers = permissions.includes(PERMISSIONS.USER_MANAGE);

  const departmentNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of departmentsQuery.data ?? []) map[d.id] = d.name;
    return map;
  }, [departmentsQuery.data]);

  const users = usersQuery.data?.data ?? [];
  const meta = usersQuery.data?.meta ?? { page: 1, limit: LIMIT, total: 0 };

  // Lọc theo từ khóa tìm kiếm (tên / email), phòng ban, và trạng thái hoạt động
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const matchName = (u.fullName ?? '').toLowerCase().includes(q);
        const matchEmail = (u.email ?? '').toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }
      if (selectedDept && u.departmentId !== selectedDept) {
        return false;
      }
      if (selectedStatus === 'ACTIVE' && u.isActive === false) {
        return false;
      }
      if (selectedStatus === 'INACTIVE' && u.isActive !== false) {
        return false;
      }
      return true;
    });
  }, [users, search, selectedDept, selectedStatus]);

  const isFiltering = Boolean(search.trim() || selectedDept || selectedStatus !== 'ALL');

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setSelectedDept('');
    setSelectedStatus('ALL');
  }, []);

  const handleReactivate = useCallback((id: string) => {
    reactivateUser.mutate(id);
  }, [reactivateUser]);

  return (
    <div className="space-y-4">
      {/* Header dòng mô tả và nút mời thành viên */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] leading-5 text-text-secondary">{t('admin:membersPage.description')}</p>
        <div className="flex items-center gap-2">
          {/* 24/09/2026: "Nhap Excel" - nhap hang loat nhan vien tu file .xlsx, xem ImportEmployeesModal.tsx */}
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-text-primary text-[13px] font-medium transition-colors cursor-pointer shrink-0"
          >
            <UploadIcon className="h-4 w-4 text-text-secondary" />
            <span>{t('admin:membersPage.importExcel')}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer shrink-0"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>{t('admin:membersPage.inviteMember')}</span>
          </button>
        </div>
      </div>

      {/* Thanh công cụ quản trị (Toolbar): Tìm kiếm + Lọc Phòng ban + Lọc Trạng thái */}
      <MembersToolbar
        search={search}
        onSearchChange={setSearch}
        selectedDept={selectedDept}
        onDeptChange={setSelectedDept}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        departments={departmentsQuery.data ?? []}
        isFiltering={isFiltering}
        onClearFilters={handleClearFilters}
      />

      <div className="rounded-radius-md border border-border-subtle bg-white overflow-hidden">
        <QueryState
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          onRetry={() => usersQuery.refetch()}
          loadingFallback={<FullPageSpinner label={t('admin:membersPage.loading')} />}
          errorTitle={t('admin:membersPage.errorTitle')}
        >
        {users.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<UserIcon className="h-8 w-8 text-text-tertiary" />} title={t('admin:membersPage.emptyTitle')} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<SearchIcon className="h-8 w-8 text-text-tertiary" />}
              title={t('admin:membersPage.noMatchTitle')}
              description={t('admin:membersPage.noMatchDescription')}
              action={
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center justify-center h-8 px-3 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[12px] font-medium text-text-primary cursor-pointer transition-colors"
                >
                  {t('admin:membersPage.clearFilters')}
                </button>
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile View: Dạng Card Stack chuẩn responsive */}
            <div className="block md:hidden p-3 space-y-3">
              {filteredUsers.map((u) => (
                <MemberCard
                  key={u.id}
                  user={u}
                  departmentName={u.departmentId ? (departmentNameById[u.departmentId] ?? '—') : '—'}
                  canManageUsers={canManageUsers}
                  onEdit={setEditingUser}
                  onDeactivate={setDeactivatingUser}
                  onReactivate={handleReactivate}
                  onDelete={setDeletingUser}
                />
              ))}
            </div>

            {/* Desktop & Tablet View: Bọc trong container có overflow-x-auto */}
            <div className="hidden md:block overflow-x-auto">
              <Table className="border-0 min-w-[700px]">
                <TableHead className="bg-bg-subtle border-b border-border-subtle">
                  <tr className="h-10">
                    <TableHeadCell className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:membersPage.columns.member')}</TableHeadCell>
                    <TableHeadCell className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:membersPage.columns.department')}</TableHeadCell>
                    <TableHeadCell className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:membersPage.columns.role')}</TableHeadCell>
                    <TableHeadCell className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:membersPage.columns.status')}</TableHeadCell>
                    <TableHeadCell className="text-right text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:membersPage.columns.actions')}</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <MemberTableRow
                      key={u.id}
                      user={u}
                      departmentName={u.departmentId ? (departmentNameById[u.departmentId] ?? '—') : '—'}
                      canManageUsers={canManageUsers}
                      onEdit={setEditingUser}
                      onDeactivate={setDeactivatingUser}
                      onReactivate={handleReactivate}
                      onDelete={setDeletingUser}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={meta.page} limit={meta.limit} total={meta.total} onPageChange={setPage} />
          </>
        )}
        </QueryState>
      </div>

      <InviteMemberModal open={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
      <ImportEmployeesModal open={isImportOpen} onClose={() => setIsImportOpen(false)} />
      <EditMemberModal user={editingUser} onClose={() => setEditingUser(null)} />

      <ConfirmDialog
        open={Boolean(deactivatingUser)}
        onClose={() => setDeactivatingUser(null)}
        title={t('admin:membersPage.deactivateConfirm.title')}
        description={t('admin:membersPage.deactivateConfirm.description', { name: deactivatingUser?.fullName })}
        confirmLabel={t('admin:membersPage.deactivateConfirm.confirmLabel')}
        danger
        isLoading={deactivateUser.isPending}
        onConfirm={() => {
          if (deactivatingUser) {
            deactivateUser.mutate(deactivatingUser.id, {
              onSuccess: () => setDeactivatingUser(null),
            });
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingUser)}
        onClose={() => setDeletingUser(null)}
        title={t('admin:membersPage.deleteConfirm.title')}
        description={t('admin:membersPage.deleteConfirm.description', { name: deletingUser?.fullName })}
        confirmLabel={t('admin:membersPage.deleteConfirm.confirmLabel')}
        danger
        isLoading={deleteUser.isPending}
        onConfirm={() => {
          if (deletingUser) {
            deleteUser.mutate(deletingUser.id, {
              onSuccess: () => setDeletingUser(null),
            });
          }
        }}
      />
    </div>
  );
}
