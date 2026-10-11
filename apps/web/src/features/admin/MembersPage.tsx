import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/stores/auth.store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EditIcon, MoreVerticalIcon, PlusIcon, RefreshIcon, SearchIcon, TrashIcon, UploadIcon, UserIcon } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { useDeactivateUser, useDeleteUser, useDepartmentsQuery, useReactivateUser, useUsersQuery } from './hooks';
import { InviteMemberModal } from './components/InviteMemberModal';
import { ImportEmployeesModal } from './components/ImportEmployeesModal';
import { EditMemberModal } from './components/EditMemberModal';
import type { User } from '@/types';

const LIMIT = 15;

/**
 * Chuẩn hóa nhãn và màu sắc ngữ cảnh cho Role Badge:
 * - Admin: bg-accent-soft text-accent border-accent/20
 * - Manager: bg-info-soft text-info border-info/20
 * - Employee: bg-subtle text-secondary border-border-subtle
 */
function getRoleBadgeConfig(roleName: string, t?: (key: string) => string) {
  const lower = roleName.trim().toLowerCase();
  if (lower.includes('admin')) {
    const label = t ? t('admin:roles.orgAdmin') : 'Quản trị viên tổ chức'; // i18n-lint-ignore: fallback mirror dung key i18n that
    return {
      label,
      className: 'bg-accent-soft text-accent border border-accent/20 font-medium',
    };
  }
  if (lower.includes('manager')) {
    const label = t ? t('admin:roles.manager') : 'Quản lý'; // i18n-lint-ignore: fallback mirror dung key i18n that
    return {
      label,
      className: 'bg-info-soft text-info border border-info/20 font-medium',
    };
  }
  if (lower.includes('employee')) {
    const label = t ? t('admin:roles.employee') : 'Nhân viên'; // i18n-lint-ignore: fallback mirror dung key i18n that
    return {
      label,
      className: 'bg-bg-subtle text-text-secondary border border-border-subtle font-medium',
    };
  }
  return {
    label: roleName,
    className: 'bg-bg-subtle text-text-secondary border border-border-subtle font-medium',
  };
}

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

  const departmentNameById: Record<string, string> = {};
  for (const d of departmentsQuery.data ?? []) departmentNameById[d.id] = d.name;

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
      <div className="flex flex-wrap items-center gap-2.5 rounded-radius-md border border-border-subtle bg-white p-2.5">
        {/* Ô tìm kiếm theo tên hoặc email */}
        <div className="relative min-w-[240px] flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin:membersPage.searchPlaceholder')}
            className="h-9 w-full rounded-radius-sm border border-border-strong bg-white pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-tertiary transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Dropdown lọc theo Phòng ban */}
        <div className="w-[180px]">
          <CustomFilterSelect
            value={selectedDept}
            onChange={(val) => setSelectedDept(val)}
            ariaLabel={t('admin:membersPage.filterDepartmentAria')}
            options={[
              { value: '', label: t('admin:membersPage.allDepartments') },
              ...(departmentsQuery.data ?? []).map((d) => ({
                value: d.id,
                label: d.name,
              })),
            ]}
          />
        </div>

        {/* Dropdown lọc theo Trạng thái hoạt động */}
        <div className="w-[170px]">
          <CustomFilterSelect
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val)}
            ariaLabel={t('admin:membersPage.filterStatusAria')}
            options={[
              { value: 'ALL', label: t('admin:membersPage.allStatuses') },
              { value: 'ACTIVE', label: t('admin:membersPage.status.active') },
              { value: 'INACTIVE', label: t('admin:membersPage.status.inactive') },
            ]}
          />
        </div>

        {isFiltering && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSelectedDept('');
              setSelectedStatus('ALL');
            }}
            className="text-[12px] font-medium text-text-secondary hover:text-text-primary px-2 py-1.5 rounded-radius-sm hover:bg-bg-subtle transition-colors cursor-pointer"
          >
            {t('admin:membersPage.clearFilters')}
          </button>
        )}
      </div>

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
                  onClick={() => {
                    setSearch('');
                    setSelectedDept('');
                    setSelectedStatus('ALL');
                  }}
                  className="inline-flex items-center justify-center h-8 px-3 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[12px] font-medium text-text-primary cursor-pointer transition-colors"
                >
                  {t('admin:membersPage.clearFilters')}
                </button>
              }
            />
          </div>
        ) : (
          <>
            <Table className="border-0">
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
                  <TableRow key={u.id} className="h-14 border-b border-border-subtle hover:bg-bg-subtle transition-colors">
                    <TableCell label={t('admin:membersPage.columns.member')} className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.fullName} size="sm" className="h-8 w-8 text-[11px] bg-accent-soft text-accent" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[13px] text-text-primary">{u.fullName}</p>
                          <p className="truncate text-[12px] text-text-tertiary">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell label={t('admin:membersPage.columns.department')} className="px-4 py-2.5 text-[13px] text-text-secondary">
                      {u.departmentId ? (departmentNameById[u.departmentId] ?? '—') : '—'}
                    </TableCell>
                    <TableCell label={t('admin:membersPage.columns.role')} className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles ?? []).length === 0 ? (
                          <span className="text-[12px] text-text-tertiary">—</span>
                        ) : (
                          (u.roles ?? []).map((r) => {
                            const badgeCfg = getRoleBadgeConfig(r.name, t);
                            return (
                              <span
                                key={r.id}
                                className={`inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[12px] ${badgeCfg.className}`}
                              >
                                {badgeCfg.label}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </TableCell>
                    <TableCell label={t('admin:membersPage.columns.status')} className="px-4 py-2.5">
                      {u.isActive === false ? (
                        <span className="inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[12px] font-medium bg-bg-muted text-text-secondary border border-border-subtle">
                          {t('admin:membersPage.status.inactive')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[12px] font-medium bg-success-soft text-success border border-success/20">
                          {t('admin:membersPage.status.active')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell label={t('admin:membersPage.columns.actions')} className="px-4 py-2.5 text-right">
                      {/* 17/09/2026: an (khong chi disable) toan bo menu hanh dong khi khong co
                          USER_MANAGE - moi hanh dong trong menu nay (sua vai tro/phong ban, vo hieu
                          hoa, kich hoat lai) deu can quyen do, khac voi nut "Moi thanh vien" o dau
                          trang (chi can USER_INVITE, van hien cho Manager). */}
                      {canManageUsers ? (
                        <Dropdown
                          align="right"
                          trigger={({ toggle }) => (
                            <button
                              type="button"
                              onClick={toggle}
                              className="rounded-radius-sm p-1.5 text-text-tertiary hover:bg-bg-subtle hover:text-text-primary cursor-pointer transition-colors"
                              aria-label={t('admin:membersPage.optionsAria')}
                            >
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
                                <EditIcon className="h-4 w-4" /> {t('admin:membersPage.actionsMenu.editRoleDepartment')}
                              </DropdownItem>
                              {u.isActive !== false ? (
                                <DropdownItem
                                  className="text-rose-600 hover:bg-rose-50"
                                  onClick={() => {
                                    setDeactivatingUser(u);
                                    close();
                                  }}
                                >
                                  <UserIcon className="h-4 w-4" /> {t('admin:membersPage.actionsMenu.deactivate')}
                                </DropdownItem>
                              ) : (
                                <>
                                  {/* 22/07/2026 (review toan du an): truoc day KHONG co cach nao
                                      kich hoat lai 1 tai khoan da vo hieu hoa tu giao dien - backend
                                      da bo sung PATCH /users/:id/reactivate (fix loi Major) nhung
                                      thieu diem vao tu UI. Chi hien khi tai khoan dang bi vo hieu hoa. */}
                                  <DropdownItem
                                    onClick={() => {
                                      reactivateUser.mutate(u.id);
                                      close();
                                    }}
                                  >
                                    <RefreshIcon className="h-4 w-4" /> {t('admin:membersPage.actionsMenu.reactivate')}
                                  </DropdownItem>
                                  {/* 25/09/2026: xoa vinh vien - chi hien khi tai khoan DA vo hieu
                                      hoa (backend cung tu kiem tra dieu nay, xem UsersService.remove()) -
                                      dung de don han du lieu rac (vd tai khoan E2E test tao ra) khoi
                                      danh sach, khac voi "Vo hieu hoa" (van con hien, khong xoa). */}
                                  <DropdownItem
                                    className="text-rose-600 hover:bg-rose-50"
                                    onClick={() => {
                                      setDeletingUser(u);
                                      close();
                                    }}
                                  >
                                    <TrashIcon className="h-4 w-4" /> {t('admin:membersPage.actionsMenu.delete')}
                                  </DropdownItem>
                                </>
                              )}
                            </div>
                          )}
                        </Dropdown>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={meta.page} limit={meta.limit} total={isFiltering ? filteredUsers.length : meta.total} onPageChange={setPage} />
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
        onConfirm={() => {
          if (deactivatingUser) deactivateUser.mutate(deactivatingUser.id);
          setDeactivatingUser(null);
        }}
        title={t('admin:membersPage.deactivateConfirm.title')}
        description={
          deactivatingUser ? t('admin:membersPage.deactivateConfirm.description', { fullName: deactivatingUser.fullName }) : undefined
        }
        confirmLabel={t('admin:membersPage.deactivateConfirm.confirmLabel')}
        danger
      />
      <ConfirmDialog
        open={Boolean(deletingUser)}
        onClose={() => setDeletingUser(null)}
        onConfirm={() => {
          if (deletingUser) deleteUser.mutate(deletingUser.id);
          setDeletingUser(null);
        }}
        title={t('admin:membersPage.deleteConfirm.title')}
        description={deletingUser ? t('admin:membersPage.deleteConfirm.description', { fullName: deletingUser.fullName }) : undefined}
        confirmLabel={t('admin:membersPage.deleteConfirm.confirmLabel')}
        danger
      />
    </div>
  );
}
