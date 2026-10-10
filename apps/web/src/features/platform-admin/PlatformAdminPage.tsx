import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { useLogout } from '@/features/auth/hooks';
import { usePlatformOrganizationsQuery, usePlatformStatsQuery, useDeactivatePlatformOrganization, useReactivatePlatformOrganization } from './hooks';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/features/dashboard/components/KpiCard';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { AlertTriangleIcon, BuildingIcon, CascadeLogoIcon, LockIcon, LogOutIcon, MoreVerticalIcon, RefreshIcon } from '@/components/ui/Icons';
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
    <div className="min-h-screen bg-bg-canvas">
      <header className="border-b border-border-subtle bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center text-text-primary">
                <CascadeLogoIcon className="h-6 w-6 text-[#1C1B1A]" />
              </span>
              <span className="text-base font-semibold text-text-primary tracking-tight">EFS</span>
            </div>
            <div className="h-5 w-px bg-border-subtle" aria-hidden="true" />
            <div>
              <h1 className="text-[16px] leading-[24px] font-semibold text-text-primary">{t('platformAdmin:page.title')}</h1>
              <p className="text-[12px] leading-[16px] font-normal text-text-tertiary">Super Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-radius-sm border border-border-strong bg-white px-3 text-[13px] font-medium text-text-primary transition-colors hover:bg-bg-subtle cursor-pointer disabled:opacity-50"
            >
              <LogOutIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{t('platformAdmin:page.logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <p className="text-[13px] leading-[20px] text-text-secondary">{t('platformAdmin:page.description')}</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            overline={t('platformAdmin:stats.totalOrganizations')}
            value={statsQuery.data?.totalOrganizations ?? '—'}
            isLoading={statsQuery.isLoading}
            isError={statsQuery.isError}
            onRetry={() => {
              statsQuery.refetch();
            }}
          />
          <KpiCard
            overline={t('platformAdmin:stats.activeOrganizations')}
            value={statsQuery.data?.activeOrganizations ?? '—'}
            isLoading={statsQuery.isLoading}
            isError={statsQuery.isError}
            onRetry={() => {
              statsQuery.refetch();
            }}
          />
          <KpiCard
            overline={t('platformAdmin:stats.totalUsers')}
            value={statsQuery.data?.totalUsers ?? '—'}
            isLoading={statsQuery.isLoading}
            isError={statsQuery.isError}
            onRetry={() => {
              statsQuery.refetch();
            }}
          />
        </div>

        <div className="rounded-radius-md border border-border-subtle bg-white overflow-hidden">
          <QueryState
            isLoading={organizationsQuery.isLoading}
            isError={organizationsQuery.isError}
            onRetry={() => organizationsQuery.refetch()}
            loadingFallback={<FullPageSpinner label={t('platformAdmin:page.loading')} />}
            errorTitle={t('platformAdmin:page.errorTitle')}
          >
            {organizations.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={<BuildingIcon className="h-8 w-8 text-text-tertiary" />} title={t('platformAdmin:page.emptyTitle')} />
              </div>
            ) : (
              <>
                <Table className="border-0">
                  <TableHead className="bg-bg-subtle border-b border-border-subtle">
                    <tr className="h-10">
                      <TableHeadCell className="h-10 text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('platformAdmin:page.columns.organization')}</TableHeadCell>
                      <TableHeadCell className="h-10 text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('platformAdmin:page.columns.taxCode')}</TableHeadCell>
                      <TableHeadCell className="h-10 text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('platformAdmin:page.columns.userCount')}</TableHeadCell>
                      <TableHeadCell className="h-10 text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('platformAdmin:page.columns.createdAt')}</TableHeadCell>
                      <TableHeadCell className="h-10 text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('platformAdmin:page.columns.status')}</TableHeadCell>
                      <TableHeadCell className="h-10 text-right text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('platformAdmin:page.columns.actions')}</TableHeadCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {organizations.map((org) => (
                      <TableRow key={org.id} className="h-14 border-b border-border-subtle hover:bg-bg-subtle transition-colors">
                        <TableCell label={t('platformAdmin:page.columns.organization')} className="px-4 py-2.5 font-medium text-[13px] text-text-primary">
                          {org.name}
                        </TableCell>
                        <TableCell label={t('platformAdmin:page.columns.taxCode')} className="px-4 py-2.5 text-[13px] font-mono tabular-nums text-text-secondary">
                          {org.taxCode ?? '—'}
                        </TableCell>
                        <TableCell label={t('platformAdmin:page.columns.userCount')} className="px-4 py-2.5 text-[13px] font-mono tabular-nums font-medium text-text-secondary">
                          {org.userCount}
                        </TableCell>
                        <TableCell label={t('platformAdmin:page.columns.createdAt')} className="px-4 py-2.5 text-[13px] font-mono tabular-nums font-medium text-text-secondary">
                          {formatDate(org.createdAt)}
                        </TableCell>
                        <TableCell label={t('platformAdmin:page.columns.status')} className="px-4 py-2.5">
                          {org.isActive ? (
                            <span className="inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[12px] font-medium bg-success-soft text-success border border-border-subtle">
                              {t('platformAdmin:page.status.active')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[12px] font-medium bg-error-soft text-error border border-border-subtle">
                              {t('platformAdmin:page.status.inactive')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell label={t('platformAdmin:page.columns.actions')} className="px-4 py-2.5 text-right">
                          <Dropdown
                            align="right"
                            trigger={({ toggle }) => (
                              <button
                                type="button"
                                onClick={toggle}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-radius-sm text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
                                aria-label={t('platformAdmin:page.optionsAria')}
                              >
                                <MoreVerticalIcon className="h-4 w-4" />
                              </button>
                            )}
                          >
                            {({ close }) => (
                              <div className="w-48 p-1">
                                {org.isActive ? (
                                  <DropdownItem
                                    className="text-error hover:bg-error-soft"
                                    onClick={() => {
                                      setDeactivatingOrg(org);
                                      close();
                                    }}
                                  >
                                    <LockIcon className="h-4 w-4 shrink-0" /> {t('platformAdmin:page.actionsMenu.deactivate')}
                                  </DropdownItem>
                                ) : (
                                  <DropdownItem
                                    onClick={() => {
                                      reactivateOrg.mutate(org.id);
                                      close();
                                    }}
                                  >
                                    <RefreshIcon className="h-4 w-4 shrink-0 text-text-secondary" /> {t('platformAdmin:page.actionsMenu.reactivate')}
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
        </div>
      </main>

      <DeactivateConfirmModal
        org={deactivatingOrg}
        isLoading={deactivateOrg.isPending}
        onClose={() => setDeactivatingOrg(null)}
        onConfirm={() => {
          if (deactivatingOrg) {
            deactivateOrg.mutate(deactivatingOrg.id, {
              onSettled: () => setDeactivatingOrg(null),
            });
          }
        }}
      />
    </div>
  );
}

function DeactivateConfirmModal({
  org,
  isLoading,
  onClose,
  onConfirm,
}: {
  org: PlatformOrganization | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (org) {
      // Focus mac dinh vao nut Huy de ngan chan bam nham khoa to chuc
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [org]);

  if (!org) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1C1B1A]/50 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deactivate-dialog-title"
        className="relative z-10 w-full max-w-[360px] rounded-radius-lg border border-border-subtle bg-white p-6 shadow-lg animate-slide-up"
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning">
            <AlertTriangleIcon className="h-8 w-8 text-[#B45309]" />
          </div>
          <h2 id="deactivate-dialog-title" className="mt-3 text-[16px] leading-[24px] font-semibold text-text-primary">
            {t('platformAdmin:page.deactivateConfirm.title')}
          </h2>
          <p className="mt-2 text-[13px] leading-[20px] text-text-secondary">
            {t('platformAdmin:page.deactivateConfirm.description', { name: org.name })}
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-radius-sm border border-border-strong bg-white px-4 text-[13px] font-medium text-text-primary hover:bg-bg-subtle transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
          >
            {t('common:actions.cancel')}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="inline-flex h-9 items-center justify-center rounded-radius-sm bg-[#B3261E] hover:bg-[#8F1D18] px-4 text-[13px] font-medium text-white disabled:opacity-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-error"
          >
            {t('platformAdmin:page.deactivateConfirm.confirmLabel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

