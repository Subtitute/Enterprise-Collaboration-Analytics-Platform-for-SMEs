import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
// 17/09/2026: import truc tiep submodule (khong qua barrel '@app/common-dto') bang `import * as`
// (namespace, khong phai named import) - xem ghi chu chi tiet tai lib/utils.ts (barrel keo theo
// DTO dung class-transformer, throw Reflect.getMetadata is not a function; named import tu deep
// import CJS lam Rollup build that bai "not exported by ...").
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/stores/auth.store';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { BuildingIcon, EditIcon, MoreVerticalIcon, PlusIcon, TrashIcon, UserIcon, UsersIcon } from '@/components/ui/Icons';
import { useDeleteDepartment, useDepartmentsQuery, useUsersQuery } from './hooks';
import { DepartmentModal } from './components/DepartmentModal';
import type { Department } from '@/types';

export function DepartmentsPage() {
  const { t } = useTranslation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);

  const departmentsQuery = useDepartmentsQuery();
  const usersQuery = useUsersQuery({ limit: 200 });
  const deleteDepartment = useDeleteDepartment();
  const departments = departmentsQuery.data ?? [];
  const users = usersQuery.data?.data ?? [];
  // 17/09/2026: ten nguoi phu trach (Department.managerId) - dung lai useUserNameMap() da co san
  // (id -> ten hien thi, cung hook dung o AssigneePicker.tsx/useGlobalSearch.ts) thay vi tu fetch
  // rieng. Chi Org Admin (DEPARTMENT_MANAGE) moi them/sua/xoa phong ban duoc, nen an cac hanh dong
  // do voi Manager (vao duoc trang nay qua USER_INVITE, xem canAccessAdminArea/AdminPage.tsx).
  const permissions = usePermissions();
  const canManageDepartments = permissions.includes(PERMISSIONS.DEPARTMENT_MANAGE);
  const { map: userNameMap } = useUserNameMap();

  // Tính số lượng nhân sự theo từng phòng ban
  const memberCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) {
      if (!u.departmentId) continue;
      counts[u.departmentId] = (counts[u.departmentId] ?? 0) + 1;
    }
    return counts;
  }, [users]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] leading-5 text-text-secondary">{t('admin:departmentsPage.description')}</p>
        {canManageDepartments && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer shrink-0"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>{t('admin:departmentsPage.newDepartment')}</span>
          </button>
        )}
      </div>

      <div className="rounded-radius-md border border-border-subtle bg-white overflow-hidden">
        <QueryState
          isLoading={departmentsQuery.isLoading}
          isError={departmentsQuery.isError}
          onRetry={() => {
            departmentsQuery.refetch();
            usersQuery.refetch();
          }}
          loadingFallback={<FullPageSpinner label={t('admin:departmentsPage.loading')} />}
          errorTitle={t('admin:departmentsPage.errorTitle')}
        >
        {departments.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<BuildingIcon className="h-8 w-8 text-text-tertiary" />} title={t('admin:departmentsPage.emptyTitle')} />
          </div>
        ) : (
          <Table className="border-0">
            <TableHead className="bg-bg-subtle border-b border-border-subtle">
              <tr className="h-10">
                <TableHeadCell className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:departmentsPage.columns.name')}</TableHeadCell>
                <TableHeadCell className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:departmentsPage.columns.memberCount')}</TableHeadCell>
                <TableHeadCell className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:departmentsPage.columns.manager')}</TableHeadCell>
                <TableHeadCell className="text-right text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:departmentsPage.columns.actions')}</TableHeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {departments.map((d) => {
                const count = d.memberCount ?? memberCountMap[d.id] ?? 0;
                // 17/09/2026: Department.managerId that tu backend (thay cho heuristic doan qua
                // role name "lead/manager/admin" cu, co the doan SAI - vd phong ban co nhieu
                // Manager, hoac Manager khong thuoc phong ban do) - chi con can resolve id -> ten
                // hien thi qua useUserNameMap() da co san.
                const managerName = d.managerId ? userNameMap[d.managerId] : undefined;

                return (
                  <TableRow key={d.id} className="h-14 border-b border-border-subtle hover:bg-bg-subtle transition-colors">
                    {/* Cột Tên phòng ban kèm Mô tả xám nhạt bên dưới */}
                    <TableCell label={t('admin:departmentsPage.columns.name')} className="px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[13px] text-text-primary">{d.name}</p>
                        {d.description ? (
                          <p className="truncate text-[12px] text-text-tertiary">{d.description}</p>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* Cột Số thành viên trực quan: pill nền bg-subtle, icon users 14px + text MONO 13/500 text-primary tabular-nums */}
                    <TableCell label={t('admin:departmentsPage.columns.memberCount')} className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-radius-sm bg-bg-subtle border border-border-subtle px-2.5 py-1 text-[13px] font-medium font-mono tabular-nums text-text-primary">
                        <UsersIcon className="h-3.5 w-3.5 text-text-secondary" />
                        {t('admin:departmentsPage.membersCountLabel', { count })}
                      </span>
                    </TableCell>

                    {/* Cột Trưởng bộ phận / Người phụ trách */}
                    <TableCell label={t('admin:departmentsPage.columns.manager')} className="px-4 py-2.5">
                      {d.managerId && managerName ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={managerName} size="sm" className="h-8 w-8 text-[11px] bg-accent-soft text-accent" />
                          <p className="truncate text-[13px] font-medium text-text-primary">{managerName}</p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[13px] italic text-text-tertiary">
                          <UserIcon className="h-3.5 w-3.5 text-text-tertiary" />
                          {t('admin:departmentsPage.noManager')}
                        </span>
                      )}
                    </TableCell>

                    <TableCell label={t('admin:departmentsPage.columns.actions')} className="px-4 py-2.5 text-right">
                      {/* 17/09/2026: an (khong chi disable) toan bo menu Sua/Xoa khi khong co
                          DEPARTMENT_MANAGE - Manager vao duoc trang nay (qua USER_INVITE) nhung
                          chi Org Admin moi duoc thay doi co cau phong ban. */}
                      {canManageDepartments ? (
                        <Dropdown
                          align="right"
                          trigger={({ toggle }) => (
                            <button
                              type="button"
                              onClick={toggle}
                              className="rounded-radius-sm p-1.5 text-text-tertiary hover:bg-bg-subtle hover:text-text-primary cursor-pointer transition-colors"
                              aria-label={t('admin:departmentsPage.optionsAria')}
                            >
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
                                <EditIcon className="h-4 w-4" /> {t('admin:departmentsPage.actionsMenu.edit')}
                              </DropdownItem>
                              <DropdownItem
                                className="text-danger hover:bg-danger-soft"
                                onClick={() => {
                                  setDeletingDept(d);
                                  close();
                                }}
                              >
                                <TrashIcon className="h-4 w-4" /> {t('admin:departmentsPage.actionsMenu.delete')}
                              </DropdownItem>
                            </div>
                          )}
                        </Dropdown>
                      ) : (
                        <span className="text-[12px] text-text-tertiary">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        </QueryState>
      </div>

      <DepartmentModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <DepartmentModal open={Boolean(editingDept)} onClose={() => setEditingDept(null)} department={editingDept} />
      <ConfirmDialog
        open={Boolean(deletingDept)}
        onClose={() => setDeletingDept(null)}
        onConfirm={() => {
          if (deletingDept) deleteDepartment.mutate(deletingDept.id);
          setDeletingDept(null);
        }}
        title={t('admin:departmentsPage.deleteConfirm.title')}
        description={deletingDept ? t('admin:departmentsPage.deleteConfirm.description', { name: deletingDept.name }) : undefined}
        confirmLabel={t('admin:departmentsPage.deleteConfirm.confirmLabel')}
        danger
      />
    </div>
  );
}
