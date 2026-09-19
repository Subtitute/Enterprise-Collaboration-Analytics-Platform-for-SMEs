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
        <p className="text-sm text-slate-500">{t('admin:departmentsPage.description')}</p>
        {canManageDepartments && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <PlusIcon className="h-4 w-4" /> {t('admin:departmentsPage.newDepartment')}
          </Button>
        )}
      </div>

      <Card>
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
            <EmptyState icon={<BuildingIcon className="h-8 w-8" />} title={t('admin:departmentsPage.emptyTitle')} />
          </div>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableHeadCell>{t('admin:departmentsPage.columns.name')}</TableHeadCell>
                <TableHeadCell>{t('admin:departmentsPage.columns.memberCount')}</TableHeadCell>
                <TableHeadCell>{t('admin:departmentsPage.columns.manager')}</TableHeadCell>
                <TableHeadCell className="text-right">{t('admin:departmentsPage.columns.actions')}</TableHeadCell>
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
                  <TableRow key={d.id}>
                    {/* Cột Tên phòng ban kèm Mô tả xám nhạt bên dưới */}
                    <TableCell label={t('admin:departmentsPage.columns.name')}>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{d.name}</p>
                        {d.description ? (
                          <p className="truncate text-xs text-slate-500">{d.description}</p>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* Cột Số thành viên trực quan: X nhân sự */}
                    <TableCell label={t('admin:departmentsPage.columns.memberCount')}>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        <UsersIcon className="h-3.5 w-3.5 text-slate-500" />
                        {t('admin:departmentsPage.membersCountLabel', { count })}
                      </span>
                    </TableCell>

                    {/* Cột Trưởng bộ phận / Người phụ trách */}
                    <TableCell label={t('admin:departmentsPage.columns.manager')}>
                      {d.managerId && managerName ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={managerName} size="sm" />
                          <p className="truncate text-sm font-medium text-slate-800">{managerName}</p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <UserIcon className="h-3.5 w-3.5" />
                          {t('admin:departmentsPage.noManager')}
                        </span>
                      )}
                    </TableCell>

                    <TableCell label={t('admin:departmentsPage.columns.actions')} className="text-right">
                      {/* 17/09/2026: an (khong chi disable) toan bo menu Sua/Xoa khi khong co
                          DEPARTMENT_MANAGE - Manager vao duoc trang nay (qua USER_INVITE) nhung
                          chi Org Admin moi duoc thay doi co cau phong ban. */}
                      {canManageDepartments ? (
                        <Dropdown
                          align="right"
                          trigger={({ toggle }) => (
                            <button
                              onClick={toggle}
                              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
                                className="text-rose-600 hover:bg-rose-50"
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
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
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
        title={t('admin:departmentsPage.deleteConfirm.title')}
        description={deletingDept ? t('admin:departmentsPage.deleteConfirm.description', { name: deletingDept.name }) : undefined}
        confirmLabel={t('admin:departmentsPage.deleteConfirm.confirmLabel')}
        danger
      />
    </div>
  );
}
