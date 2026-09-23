import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { connectAnalyticsSocket, disconnectAnalyticsSocket } from '@/lib/socket';
import type { DateRangeOption, RecentActivityItem, VisibilityScope } from '@/types';
import { fetchAnalyticsSummary, fetchRecentActivity, fetchTaskStatusBreakdown, fetchTaskTrend, fetchUpcomingLeaves } from './api';

// 28/07/2026: them tham so departmentId (tuy chon) cho bo loc "Phong ban" tren Dashboard - dua
// vao queryKey de moi lua chon phong ban duoc cache rieng, giong het cach projectId da lam ben duoi.
// 17/09/2026: them options.enabled - AnalyticsController yeu cau ANALYTICS_VIEW (Employee KHONG
// co, xem DEFAULT_ROLE_PERMISSIONS.EMPLOYEE) nen Dashboard tat han query nay cho Employee thay vi
// goi roi nhan 403 (xem DashboardPage.tsx).
export function useAnalyticsSummary(range: DateRangeOption = '30d', departmentId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['analytics', 'summary', range, departmentId ?? null],
    queryFn: () => fetchAnalyticsSummary(range, departmentId),
    enabled: options?.enabled,
  });
}

// 28/07/2026: GET /analytics/task-trend KHONG ho tro departmentId (gioi han da biet cua backend -
// xem Technical_Spec.md) nen hook nay co tinh KHONG nhan them tham so departmentId.
export function useTaskTrend(range: DateRangeOption = '30d', options?: { enabled?: boolean }) {
  return useQuery({ queryKey: ['analytics', 'task-trend', range], queryFn: () => fetchTaskTrend(range), enabled: options?.enabled });
}

// 28/07/2026: them tham so departmentId (tuy chon), theo dung cach projectId da duoc thread vao
// queryKey/fetch* ben duoi.
export function useTaskStatusBreakdown(
  range: DateRangeOption = '30d',
  projectId?: string,
  departmentId?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['analytics', 'task-status-breakdown', range, projectId ?? null, departmentId ?? null],
    queryFn: () => fetchTaskStatusBreakdown(range, projectId, departmentId),
    enabled: options?.enabled,
  });
}

const LIVE_FEED_LIMIT = 15;

/**
 * Ket hop snapshot REST (GET /analytics/recent-activity) voi cac su kien realtime tu
 * /ws/analytics ('analytics:activity'). Socket duoc mo/dong ngay trong hook nay (chi Dashboard
 * can toi) va tu ket noi lai neu accessToken doi (sau silent-refresh).
 */
export function useRecentActivityFeed(limit = LIVE_FEED_LIMIT) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const query = useQuery({ queryKey: ['analytics', 'recent-activity'], queryFn: fetchRecentActivity });
  const scope: VisibilityScope = query.data?.scope ?? 'self';
  const [liveItems, setLiveItems] = useState<RecentActivityItem[]>([]);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      disconnectAnalyticsSocket();
      setIsLive(false);
      return;
    }
    const socket = connectAnalyticsSocket(accessToken);

    const onConnect = () => setIsLive(true);
    const onDisconnect = () => setIsLive(false);
    // Payload tho tu AnalyticsGateway.emitActivity(): { eventId, eventType, occurredAt, actorId }
    // (apps/analytics-service/src/realtime/analytics.gateway.ts) - khong giong shape REST
    // /analytics/recent-activity, nen phai doi ten field tai day truoc khi dua vao danh sach.
    //
    // 23/09/2026: AnalyticsGateway phat WS theo PHONG TOAN TO CHUC (khong co phong rieng theo
    // phong ban), nen 1 Manager dang o pham vi 'department' van NHAN duoc push cua ca to chuc qua
    // socket - loc lai o day cho truong hop 'self' (co the xac dinh chac chan: actorId phai =
    // chinh minh). Truong hop 'department' KHONG loc duoc chinh xac o FE (khong co danh sach
    // thanh vien phong ban minh phu trach san o day) nen tam thoi van hien thi day du cho pham vi
    // nay o phan LIVE PUSH - snapshot REST ban dau (query.data.items) van duoc loc DUNG server-side.
    const onActivity = (raw: { eventId: string; eventType: string; occurredAt: string; actorId: string | null }) => {
      if (scope === 'self' && raw.actorId !== currentUserId) return;
      const item: RecentActivityItem = {
        id: raw.eventId,
        actorId: raw.actorId,
        action: raw.eventType,
        createdAt: raw.occurredAt,
      };
      setLiveItems((prev) => [item, ...prev].slice(0, limit));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('analytics:activity', onActivity);
    if (socket.connected) setIsLive(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('analytics:activity', onActivity);
      disconnectAnalyticsSocket();
    };
  }, [accessToken, limit, scope, currentUserId]);

  const items = useMemo(() => {
    const seen = new Set<string>();
    const combined: RecentActivityItem[] = [];
    for (const item of [...liveItems, ...(query.data?.items ?? [])]) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      combined.push(item);
    }
    return combined.slice(0, limit);
  }, [liveItems, query.data, limit]);

  return { items, isLoading: query.isLoading, isError: query.isError, isLive, scope };
}

/**
 * Hook truy vấn danh sách nghỉ phép sắp tới đã được duyệt:
 * Tự động lọc các đơn có ngày kết thúc >= ngày hiện tại, sắp xếp theo ngày bắt đầu tăng dần.
 */
export function useUpcomingLeavesQuery() {
  return useQuery({
    queryKey: ['leave-requests', 'upcoming'],
    queryFn: fetchUpcomingLeaves,
    staleTime: 60 * 1000,
    retry: false,
  });
}
