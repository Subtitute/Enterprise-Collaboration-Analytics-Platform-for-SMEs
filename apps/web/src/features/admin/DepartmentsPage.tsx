import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { Department, User } from '@/types';

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

  // Tính số lượng nhân sự và tìm Người phụ trách / Trưởng bộ phận theo từng phòng ban
  const { memberCountMap, managerMap } = useMemo(() => {
    const counts: Record<string, number> = {};
    const managers: Record<string, User> = {};

    for (const u of users) {
      if (!u.departmentId) continue;
      counts[u.departmentId] = (counts[u.departmentId] ?? 0) + 1;

      // Xác định Trưởng bộ phận / Quản trị viên của phòng ban
      const isLead = (u.roles ?? []).some((r) => {
        const rName = r.name.toLowerCase();
        return rName.includes('lead') || rName.includes('manager') || rName.includes('trưởng') || rName.includes('admin');
      });

      if (isLead && !managers[u.departmentId]) {
        managers[u.departmentId] = u;
      }
    }

    // Nếu chưa có lead rõ ràng nhưng phòng có nhân sự, lấy người đầu tiên làm đại diện phụ trách
    for (const u of users) {
      if (u.departmentId && !managers[u.departmentId]) {
        managers[u.departmentId] = u;
      }
    }

    return { memberCountMap: counts, managerMap: managers };
  }, [users]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{t('admin:departmentsPage.description')}</p>
        <Button onClick={() => setIsCreateOpen(true)}>
          <PlusIcon className="h-4 w-4" /> {t('admin:departmentsPage.newDepartment')}
        </Button>
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
                const manager = managerMap[d.id];

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
                      {manager ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={manager.fullName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{manager.fullName}</p>
                            <p className="truncate text-xs text-slate-400">{manager.email}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <UserIcon className="h-3.5 w-3.5" />
                          {t('admin:departmentsPage.noManager')}
                        </span>
                      )}
                    </TableCell>

                    <TableCell label={t('admin:departmentsPage.columns.actions')} className="text-right">
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
