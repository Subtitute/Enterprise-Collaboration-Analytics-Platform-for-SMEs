import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlatformOrganizationsQuery, usePlatformStatsQuery, useDeactivatePlatformOrganization, useReactivatePlatformOrganization } from './hooks';
import { Pagination } from '@/components/ui/Pagination';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/features/dashboard/components/KpiCard';
import { BuildingIcon } from '@/components/ui/Icons';
import type { PlatformOrganization } from '@/types';
import { PlatformAdminHeader } from './components/PlatformAdminHeader';
import { PlatformOrganizationsTable } from './components/PlatformOrganizationsTable';
import { DeactivateConfirmModal } from './components/DeactivateConfirmModal';

const LIMIT = 15;

/**
 * 16/09/2026: "Super Admin" (tinh nang moi) - trang rieng, KHONG dung AppShell/Sidebar/Topbar
 * (nhung thanh phan do gia dinh 1 to chuc nghiep vu that voi du an/tai lieu/khach hang... - Super
 * Admin khong thuoc to chuc nao ca, chi quan ly vong doi cac to chuc dang ky tren nen tang). Bo
 * cuc toi gian: thanh tieu de rieng + KPI nen tang + bang danh sach to chuc.
 */
export function PlatformAdminPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [deactivatingOrg, setDeactivatingOrg] = useState<PlatformOrganization | null>(null);

  const statsQuery = usePlatformStatsQuery();
  const organizationsQuery = usePlatformOrganizationsQuery({ page, limit: LIMIT });
  const deactivateOrg = useDeactivatePlatformOrganization();
  const reactivateOrg = useReactivatePlatformOrganization();

  const organizations = organizationsQuery.data?.data ?? [];
  const meta = organizationsQuery.data?.meta ?? { page: 1, limit: LIMIT, total: 0 };

  const handleDeactivateClick = useCallback((org: PlatformOrganization) => {
    setDeactivatingOrg(org);
  }, []);

  const handleReactivateClick = useCallback((id: string) => {
    reactivateOrg.mutate(id);
  }, [reactivateOrg]);

  const handleModalClose = useCallback(() => {
    setDeactivatingOrg(null);
  }, []);

  const handleConfirmDeactivate = useCallback(() => {
    if (deactivatingOrg) {
      deactivateOrg.mutate(deactivatingOrg.id, {
        onSettled: () => setDeactivatingOrg(null),
      });
    }
  }, [deactivatingOrg, deactivateOrg]);

  return (
    <div className="min-h-screen bg-bg-canvas">
      <PlatformAdminHeader />

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
                <PlatformOrganizationsTable
                  organizations={organizations}
                  onDeactivate={handleDeactivateClick}
                  onReactivate={handleReactivateClick}
                />
                <Pagination page={meta.page} limit={meta.limit} total={meta.total} onPageChange={setPage} />
              </>
            )}
          </QueryState>
        </div>
      </main>

      <DeactivateConfirmModal
        org={deactivatingOrg}
        isLoading={deactivateOrg.isPending}
        onClose={handleModalClose}
        onConfirm={handleConfirmDeactivate}
      />
    </div>
  );
}
