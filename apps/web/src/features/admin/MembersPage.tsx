import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS } from '@/constants/permissions';
import { useAuthStore, usePermissions } from '@/stores/auth.store';
import { Table, TableBody, TableHead, TableHeadCell } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { InfoIcon, PlusIcon, SearchIcon, UploadIcon, UserIcon } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { useFaceStatusesQuery } from '@/features/face/hooks';
import { useDeactivateUser, useDeleteUser, useDepartmentsQuery, useDirectoryQuery, useReactivateUser } from './hooks';
import { InviteMemberModal } from './components/InviteMemberModal';
import { ImportEmployeesModal } from './components/ImportEmployeesModal';
import { EditMemberModal } from './components/EditMemberModal';
import { MemberTableRow } from './components/MemberTableRow';
import { MemberCard } from './components/MemberCard';
import { MembersToolbar } from './components/MembersToolbar';
import { EmployeeProfileDrawer } from './components/EmployeeProfileDrawer';
import type { FaceStatus, User } from '@/types';

const LIMIT = 15;

/**
 * 26/10/2026: Quan tri > Thanh vien mo rong thanh "Danh sach nhan vien" (Technical_Spec.md muc 27.6,
 * Wireframe muc 16.1) - doc GET /users/directory (ho so day du, loc/tim/phan trang o SERVER) thay vi
 * GET /users. Org Admin: ca to chuc; Manager: CHI Employee phong minh (phong ban khoa san, khong co
 * cot Phong ban/Vai tro/Trang thai). Cot "Anh nhan dien" la trang thai lay theo lo tu ml-service.
 * Bam 1 dong -> Ho so nhan vien (EmployeeProfileDrawer).
 */
export function MembersPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedFace, setSelectedFace] = useState('');

  const permissions = usePermissions();
  const canManageUsers = permissions.includes(PERMISSIONS.USER_MANAGE);
  const myDepartmentId = useAuthStore((s) => s.user?.departmentId ?? null);
  const isManagerScope = !canManageUsers && permissions.includes(PERMISSIONS.USER_INVITE) && Boolean(myDepartmentId);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => setPage(1), [debouncedSearch, selectedDept, selectedStatus]);

  const directoryQuery = useDirectoryQuery({
    page,
    limit: LIMIT,
    search: debouncedSearch || undefined,
    departmentId: canManageUsers && selectedDept ? selectedDept : undefined,
    status: canManageUsers && selectedStatus !== 'ALL' ? (selectedStatus as 'ACTIVE' | 'INACTIVE') : undefined,
  });
  const departmentsQuery = useDepartmentsQuery();
  const deactivateUser = useDeactivateUser();
  const reactivateUser = useReactivateUser();
  const deleteUser = useDeleteUser();

  const departmentNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of departmentsQuery.data ?? []) map[d.id] = d.name;
    return map;
  }, [departmentsQuery.data]);

  const users = useMemo(() => directoryQuery.data?.data ?? [], [directoryQuery.data]);
  const meta = directoryQuery.data?.meta ?? { page: 1, limit: LIMIT, total: 0 };
  const userIds = useMemo(() => users.map((u) => u.id), [users]);
  const faceQuery = useFaceStatusesQuery(userIds);
  const faceById = useMemo(() => {
    const map: Record<string, FaceStatus> = {};
    for (const s of faceQuery.data ?? []) if (s.userId) map[s.userId] = s.status;
    return map;
  }, [faceQuery.data]);

  // Loc theo trang thai anh nhan dien chi tren TRANG HIEN TAI (iam-service khong biet trang thai nay).
  const filteredUsers = useMemo(
    () => (selectedFace ? users.filter((u) => (faceById[u.id] ?? 'NONE') === selectedFace) : users),
    [users, faceById, selectedFace],
  );

  const isFiltering = Boolean(search.trim() || selectedDept || selectedStatus !== 'ALL' || selectedFace);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setSelectedDept('');
    setSelectedStatus('ALL');
    setSelectedFace('');
  }, []);

  const handleReactivate = useCallback((id: string) => {
    reactivateUser.mutate(id);
  }, [reactivateUser]);

  const handleOpen = useCallback((u: User) => setProfileUserId(u.id), []);
  const myDepartmentName = myDepartmentId ? departmentNameById[myDepartmentId] ?? '' : '';
  const headCell = 'text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] leading-5 text-text-secondary">
          {isManagerScope ? t('admin:membersPage.managerDescription', { department: myDepartmentName || '—' }) : t('admin:membersPage.description')}
        </p>
        <div className="flex items-center gap-2">
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
        lockedDepartmentName={canManageUsers ? undefined : myDepartmentName}
        selectedFace={selectedFace}
        onFaceChange={setSelectedFace}
      />

      {isManagerScope && (
        <p className="flex items-center gap-2 text-[12px] text-text-secondary">
          <InfoIcon className="h-3.5 w-3.5 shrink-0" />
          {t('admin:membersPage.managerScopeNote')}
        </p>
      )}

      <div className="rounded-radius-md border border-border-subtle bg-white overflow-hidden">
        <QueryState
          isLoading={directoryQuery.isLoading}
          isError={directoryQuery.isError}
          onRetry={() => directoryQuery.refetch()}
          loadingFallback={<FullPageSpinner label={t('admin:membersPage.loading')} />}
          errorTitle={t('admin:membersPage.errorTitle')}
        >
          {users.length === 0 && !isFiltering ? (
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
                    faceStatus={faceById[u.id]}
                    onOpen={handleOpen}
                  />
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <Table className="border-0 min-w-[760px]">
                  <TableHead className="bg-bg-subtle border-b border-border-subtle">
                    <tr className="h-10">
                      <TableHeadCell className={headCell}>{t('admin:membersPage.columns.member')}</TableHeadCell>
                      <TableHeadCell className={headCell}>{t('admin:membersPage.columns.employeeCode')}</TableHeadCell>
                      <TableHeadCell className={headCell}>{t('admin:membersPage.columns.phone')}</TableHeadCell>
                      {canManageUsers && <TableHeadCell className={headCell}>{t('admin:membersPage.columns.department')}</TableHeadCell>}
                      {canManageUsers && <TableHeadCell className={headCell}>{t('admin:membersPage.columns.role')}</TableHeadCell>}
                      <TableHeadCell className={headCell}>{t('admin:membersPage.columns.face')}</TableHeadCell>
                      {canManageUsers && <TableHeadCell className={headCell}>{t('admin:membersPage.columns.status')}</TableHeadCell>}
                      {canManageUsers && <TableHeadCell className={`text-right ${headCell}`}>{t('admin:membersPage.columns.actions')}</TableHeadCell>}
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
                        faceStatus={faceById[u.id]}
                        showOrgColumns={canManageUsers}
                        onOpen={handleOpen}
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
      <EmployeeProfileDrawer
        userId={profileUserId}
        onClose={() => setProfileUserId(null)}
        canManageUsers={canManageUsers}
        departmentNameById={departmentNameById}
      />

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
