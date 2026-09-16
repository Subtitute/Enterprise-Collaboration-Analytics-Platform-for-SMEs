import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useLogout } from '@/features/auth/hooks';
import { usePlatformOrganizationsQuery, usePlatformStatsQuery, useDeactivatePlatformOrganization, useReactivatePlatformOrganization } from './hooks';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/features/dashboard/components/KpiCard';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { BuildingIcon, CheckCircleIcon, LockIcon, LogOutIcon, MoreVerticalIcon, RefreshIcon, UsersIcon } from '@/components/ui/Icons';
import { formatDate } from '@/lib/utils';
import type { PlatformOrganization } from '@/types';

const LIMIT = 15;

/**
 * 16/09/2026: "Super Admin" (tinh nang moi) - trang rieng, KHONG dung AppShell/Sidebar/Topbar
 * (nhung thanh phan do gia dinh 1 to chuc nghiep vu that voi du an/tai lieu/khach hang... - Super
 * Admin khong thuoc to chuc nao ca, chi quan ly vong doi cac to chuc dang ky tren nen tang). Bo
 * cuc toi gian: thanh tieu de rieng + KPI nen tang + bang danh sach to chuc.
 */
export function PlatformAdminPage() {
  const { t } = useTranslation();
  const fullName = useAuthStore((s) => s.user?.fullName);
  const logout = useLogout();
  const [page, setPage] = useState(1);
  const [deactivatingOrg, setDeactivatingOrg] = useState<PlatformOrganization | null>(null);

  const statsQuery = usePlatformStatsQuery();
  const organizationsQuery = usePlatformOrganizationsQuery({ page, limit: LIMIT });
  const deactivateOrg = useDeactivatePlatformOrganization();
  const reactivateOrg = useReactivatePlatformOrganization();

  const organizations = organizationsQuery.data?.data ?? [];
  const meta = organizationsQuery.data?.meta ?? { page: 1, limit: LIMIT, total: 0 };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-sm font-bold text-white">
              EFS
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-slate-900">{t('platformAdmin:page.title')}</h1>
              <p className="text-xs text-slate-500">{fullName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="outline" size="sm" onClick={() => logout.mutate()} isLoading={logout.isPending}>
              <LogOutIcon className="h-4 w-4" /> {t('platformAdmin:page.logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <p className="text-sm text-slate-500">{t('platformAdmin:page.description')}</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label={t('platformAdmin:stats.totalOrganizations')}
            value={statsQuery.data?.totalOrganizations ?? '—'}
            icon={<BuildingIcon className="h-5 w-5" />}
            isLoading={statsQuery.isLoading}
            isError={statsQuery.isError}
            onRetry={() => statsQuery.refetch()}
          />
          <KpiCard
            label={t('platformAdmin:stats.activeOrganizations')}
            value={statsQuery.data?.activeOrganizations ?? '—'}
            icon={<CheckCircleIcon className="h-5 w-5" />}
            accentClassName="bg-emerald-100 text-emerald-600"
            isLoading={statsQuery.isLoading}
            isError={statsQuery.isError}
            onRetry={() => statsQuery.refetch()}
          />
          <KpiCard
            label={t('platformAdmin:stats.totalUsers')}
            value={statsQuery.data?.totalUsers ?? '—'}
            icon={<UsersIcon className="h-5 w-5" />}
            accentClassName="bg-indigo-100 text-indigo-600"
            isLoading={statsQuery.isLoading}
            isError={statsQuery.isError}
            onRetry={() => statsQuery.refetch()}
          />
        </div>

        <Card>
          <QueryState
            isLoading={organizationsQuery.isLoading}
            isError={organizationsQuery.isError}
            onRetry={() => organizationsQuery.refetch()}
            loadingFallback={<FullPageSpinner label={t('platformAdmin:page.loading')} />}
            errorTitle={t('platformAdmin:page.errorTitle')}
          >
            {organizations.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={<BuildingIcon className="h-8 w-8" />} title={t('platformAdmin:page.emptyTitle')} />
              </div>
            ) : (
              <>
                <Table>
                  <TableHead>
                    <tr>
                      <TableHeadCell>{t('platformAdmin:page.columns.organization')}</TableHeadCell>
                      <TableHeadCell>{t('platformAdmin:page.columns.taxCode')}</TableHeadCell>
                      <TableHeadCell>{t('platformAdmin:page.columns.userCount')}</TableHeadCell>
                      <TableHeadCell>{t('platformAdmin:page.columns.createdAt')}</TableHeadCell>
                      <TableHeadCell>{t('platformAdmin:page.columns.status')}</TableHeadCell>
                      <TableHeadCell className="text-right">{t('platformAdmin:page.columns.actions')}</TableHeadCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {organizations.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell label={t('platformAdmin:page.columns.organization')} className="font-medium text-slate-800">
                          {org.name}
                        </TableCell>
                        <TableCell label={t('platformAdmin:page.columns.taxCode')} className="text-sm text-slate-600">
                          {org.taxCode ?? '—'}
                        </TableCell>
                        <TableCell label={t('platformAdmin:page.columns.userCount')} className="text-sm text-slate-600">
                          {org.userCount}
                        </TableCell>
                        <TableCell label={t('platformAdmin:page.columns.createdAt')} className="text-sm text-slate-600">
                          {formatDate(org.createdAt)}
                        </TableCell>
                        <TableCell label={t('platformAdmin:page.columns.status')}>
                          <Badge variant={org.isActive ? 'success' : 'danger'}>
                            {org.isActive ? t('platformAdmin:page.status.active') : t('platformAdmin:page.status.inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell label={t('platformAdmin:page.columns.actions')} className="text-right">
                          <Dropdown
                            align="right"
                            trigger={({ toggle }) => (
                              <button
                                onClick={toggle}
                                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                aria-label={t('platformAdmin:page.optionsAria')}
                              >
                                <MoreVerticalIcon className="h-4 w-4" />
                              </button>
                            )}
                          >
                            {({ close }) => (
                              <div className="w-52 py-1.5">
                                {org.isActive ? (
                                  <DropdownItem
                                    className="text-rose-600 hover:bg-rose-50"
                                    onClick={() => {
                                      setDeactivatingOrg(org);
                                      close();
                                    }}
                                  >
                                    <LockIcon className="h-4 w-4" /> {t('platformAdmin:page.actionsMenu.deactivate')}
                                  </DropdownItem>
                                ) : (
                                  <DropdownItem
                                    onClick={() => {
                                      reactivateOrg.mutate(org.id);
                                      close();
                                    }}
                                  >
                                    <RefreshIcon className="h-4 w-4" /> {t('platformAdmin:page.actionsMenu.reactivate')}
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
      </main>

      <ConfirmDialog
        open={Boolean(deactivatingOrg)}
        onClose={() => setDeactivatingOrg(null)}
        onConfirm={() => {
          if (deactivatingOrg) deactivateOrg.mutate(deactivatingOrg.id);
          setDeactivatingOrg(null);
        }}
        title={t('platformAdmin:page.deactivateConfirm.title')}
        description={
          deactivatingOrg ? t('platformAdmin:page.deactivateConfirm.description', { name: deactivatingOrg.name }) : undefined
        }
        confirmLabel={t('platformAdmin:page.deactivateConfirm.confirmLabel')}
        danger
      />
    </div>
  );
}
