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
import { EditIcon, MoreVerticalIcon, PlusIcon, RefreshIcon, SearchIcon, UserIcon } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { useDeactivateUser, useDepartmentsQuery, useReactivateUser, useUsersQuery } from './hooks';
import { InviteMemberModal } from './components/InviteMemberModal';
import { EditMemberModal } from './components/EditMemberModal';
import type { User } from '@/types';

const LIMIT = 15;

/**
 * Chuẩn hóa nhãn và màu sắc ngữ cảnh cho Role Badge (hỗ trợ đa ngôn ngữ):
 * - Admin (Quản trị viên / Org Admin): bg-indigo-50 text-indigo-700 border-indigo-200/60
 * - Manager (Quản lý): bg-purple-50 text-purple-700 border-purple-200/60
 * - Employee (Nhân viên): bg-slate-100 text-slate-700 border-slate-200/60
 */
function getRoleBadgeConfig(roleName: string, t?: (key: string) => string) {
  const lower = roleName.trim().toLowerCase();
  // 16/09/2026: bo cac nhanh khop tieng Viet ('quản trị'/'quản lý'/'nhân viên') o 3 dieu kien
  // if() ben duoi - Role.name luon la tieng Anh ('Org Admin'/'Manager'/'Employee', xem
  // DefaultRoleName trong packages/common-dto), khong co endpoint doi ten vai tro nao ca nen cac
  // nhanh nay khong bao gio khop (dead code) va vi pham linter hardcode tieng Viet. Chuoi tieng
  // Viet trong bien `label` ben duoi la truong hop khac (fallback co chu y khi khong truyen t),
  // xem comment rieng ngay canh no.
  if (lower.includes('admin')) {
    // Fallback co chu y, chi dung khi ham nay duoc goi ma khong truyen t vao (tham so t la
    // optional) - minh giu nguyen dung chuoi that trong vi/admin.json (key admin:roles.orgAdmin)
    // de 2 nguon luon khop nhau, day khong phai UI copy hardcode. i18n-lint-ignore (16/09/2026)
    const label = t ? t('admin:roles.orgAdmin') : 'Quản trị viên tổ chức';
    return {
      label,
      className: 'bg-indigo-50 text-indigo-700 border border-indigo-200/70 font-medium',
    };
  }
  if (lower.includes('manager')) {
    // Fallback co chu y, chi dung khi ham nay duoc goi ma khong truyen t vao - minh giu nguyen
    // dung chuoi that trong vi/admin.json (key admin:roles.manager) de 2 nguon luon khop nhau,
    // day khong phai UI copy hardcode. i18n-lint-ignore (16/09/2026)
    const label = t ? t('admin:roles.manager') : 'Quản lý';
    return {
      label,
      className: 'bg-purple-50 text-purple-700 border border-purple-200/70 font-medium',
    };
  }
  if (lower.includes('employee')) {
    // Fallback co chu y, chi dung khi ham nay duoc goi ma khong truyen t vao - minh giu nguyen
    // dung chuoi that trong vi/admin.json (key admin:roles.employee) de 2 nguon luon khop nhau,
    // day khong phai UI copy hardcode. i18n-lint-ignore (16/09/2026)
    const label = t ? t('admin:roles.employee') : 'Nhân viên';
    return {
      label,
      className: 'bg-slate-100 text-slate-700 border border-slate-200 font-medium',
    };
  }
  return {
    label: roleName,
    className: 'bg-slate-100 text-slate-700 border border-slate-200 font-medium',
  };
}

export function MembersPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);

  // Bộ lọc nhanh (Toolbar)
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const usersQuery = useUsersQuery({ page, limit: LIMIT });
  const departmentsQuery = useDepartmentsQuery();
  const deactivateUser = useDeactivateUser();
  const reactivateUser = useReactivateUser();
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
        <p className="text-sm text-slate-500">{t('admin:membersPage.description')}</p>
        <Button onClick={() => setIsInviteOpen(true)}>
          <PlusIcon className="h-4 w-4" /> {t('admin:membersPage.inviteMember')}
        </Button>
      </div>

      {/* Thanh công cụ quản trị (Toolbar): Tìm kiếm + Lọc Phòng ban + Lọc Trạng thái */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
        {/* Ô tìm kiếm theo tên hoặc email */}
        <div className="relative min-w-[240px] flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin:membersPage.searchPlaceholder')}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Dropdown lọc theo Phòng ban */}
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

        {/* Dropdown lọc theo Trạng thái hoạt động */}
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

        {isFiltering && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSelectedDept('');
              setSelectedStatus('ALL');
            }}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            {t('admin:membersPage.clearFilters')}
          </button>
        )}
      </div>

      <Card>
        <QueryState
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          onRetry={() => usersQuery.refetch()}
          loadingFallback={<FullPageSpinner label={t('admin:membersPage.loading')} />}
          errorTitle={t('admin:membersPage.errorTitle')}
        >
        {users.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<UserIcon className="h-8 w-8" />} title={t('admin:membersPage.emptyTitle')} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<SearchIcon className="h-8 w-8" />}
              title={t('admin:membersPage.noMatchTitle')}
              description={t('admin:membersPage.noMatchDescription')}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setSelectedDept('');
                    setSelectedStatus('ALL');
                  }}
                >
                  {t('admin:membersPage.clearFilters')}
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <Table>
              <TableHead>
                <tr>
                  <TableHeadCell>{t('admin:membersPage.columns.member')}</TableHeadCell>
                  <TableHeadCell>{t('admin:membersPage.columns.department')}</TableHeadCell>
                  <TableHeadCell>{t('admin:membersPage.columns.role')}</TableHeadCell>
                  <TableHeadCell>{t('admin:membersPage.columns.status')}</TableHeadCell>
                  <TableHeadCell className="text-right">{t('admin:membersPage.columns.actions')}</TableHeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell label={t('admin:membersPage.columns.member')}>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{u.fullName}</p>
                          <p className="truncate text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell label={t('admin:membersPage.columns.department')} className="text-sm text-slate-600">
                      {u.departmentId ? (departmentNameById[u.departmentId] ?? '—') : '—'}
                    </TableCell>
                    <TableCell label={t('admin:membersPage.columns.role')}>
                      <div className="flex flex-wrap gap-1">
                        {(u.roles ?? []).length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          (u.roles ?? []).map((r) => {
                            const badgeCfg = getRoleBadgeConfig(r.name, t);
                            return (
                              <span
                                key={r.id}
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${badgeCfg.className}`}
                              >
                                {badgeCfg.label}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </TableCell>
                    <TableCell label={t('admin:membersPage.columns.status')}>
                      <Badge variant={u.isActive === false ? 'danger' : 'success'}>
                        {u.isActive === false ? t('admin:membersPage.status.inactive') : t('admin:membersPage.status.active')}
                      </Badge>
                    </TableCell>
                    <TableCell label={t('admin:membersPage.columns.actions')} className="text-right">
                      {/* 17/09/2026: an (khong chi disable) toan bo menu hanh dong khi khong co
                          USER_MANAGE - moi hanh dong trong menu nay (sua vai tro/phong ban, vo hieu
                          hoa, kich hoat lai) deu can quyen do, khac voi nut "Moi thanh vien" o dau
                          trang (chi can USER_INVITE, van hien cho Manager). */}
                      {canManageUsers ? (
                        <Dropdown
                          align="right"
                          trigger={({ toggle }) => (
                            <button
                              onClick={toggle}
                              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
                                  <RefreshIcon className="h-4 w-4" /> {t('admin:membersPage.actionsMenu.reactivate')}
                                </DropdownItem>
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
        title={t('admin:membersPage.deactivateConfirm.title')}
        description={
          deactivatingUser ? t('admin:membersPage.deactivateConfirm.description', { fullName: deactivatingUser.fullName }) : undefined
        }
        confirmLabel={t('admin:membersPage.deactivateConfirm.confirmLabel')}
        danger
      />
    </div>
  );
}
