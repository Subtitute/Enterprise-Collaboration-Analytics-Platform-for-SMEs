import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { extractErrorMessage } from '@/lib/api-client';
import { toast } from '@/stores/toast.store';
import {
  deactivatePlatformOrganization,
  fetchPlatformOrganizations,
  fetchPlatformStats,
  reactivatePlatformOrganization,
} from './api';

const ORGANIZATIONS_KEY = ['platform-admin', 'organizations'];
const STATS_KEY = ['platform-admin', 'stats'];

export function usePlatformOrganizationsQuery(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: [...ORGANIZATIONS_KEY, params],
    queryFn: () => fetchPlatformOrganizations(params),
  });
}

export function usePlatformStatsQuery() {
  return useQuery({ queryKey: STATS_KEY, queryFn: fetchPlatformStats });
}

export function useDeactivatePlatformOrganization() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivatePlatformOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
      toast.success(t('platformAdmin:toast.organizationDeactivated'));
    },
    onError: (error) => toast.error(t('platformAdmin:toast.organizationDeactivateFailed'), extractErrorMessage(error)),
  });
}

export function useReactivatePlatformOrganization() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reactivatePlatformOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_KEY });
      toast.success(t('platformAdmin:toast.organizationReactivated'));
    },
    onError: (error) => toast.error(t('platformAdmin:toast.organizationReactivateFailed'), extractErrorMessage(error)),
  });
}
