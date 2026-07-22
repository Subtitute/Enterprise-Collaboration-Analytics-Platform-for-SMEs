import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { fetchUser } from './api';

export function useMyProfileQuery() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['users', userId],
    queryFn: () => fetchUser(userId as string),
    enabled: Boolean(userId),
  });
}
