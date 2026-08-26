import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { formatRelativeTime } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { ChevronDownIcon } from '@/components/ui/Icons';
import { useRecentActivityFeed } from '../hooks';
import type { RecentActivityItem } from '@/types';

interface ActionDisplay {
  fullText: string;
  dotColor: string;
  badgeColor: string;
}

function getActionDisplay(action: string, t: (key: string, options?: any) => string): ActionDisplay {
  const normalized = action.replace(/[._]/g, '_').toLowerCase();

  // Phân loại ngữ cảnh hành động:
  // - Xóa (Delete): Đỏ (Red/Rose)
  // - Tạo mới (Create/Upload/Register): Xanh lá (Emerald/Green)
  // - Cập nhật / Đổi trạng thái / Giao việc (Update/Status/Assign): Xanh dương (Blue/Sky) hoặc Cam (Amber)
  const isDelete = normalized.includes('delete') || normalized.includes('deactivate') || normalized.includes('remove');
  const isCreate = normalized.includes('created') || normalized.includes('registered') || normalized.includes('upload');
  const isUpdate = normalized.includes('update') || normalized.includes('status') || normalized.includes('assign') || normalized.includes('share') || normalized.includes('complete');

  let dotColor = 'bg-slate-400 ring-slate-100';
  let badgeColor = 'bg-slate-100 text-slate-700';

  if (isDelete) {
    dotColor = 'bg-rose-500 ring-rose-100';
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200/60';
  } else if (isCreate) {
    dotColor = 'bg-emerald-500 ring-emerald-100';
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
  } else if (isUpdate) {
    dotColor = 'bg-blue-500 ring-blue-100';
    badgeColor = 'bg-blue-50 text-blue-700 border-blue-200/60';
  }

  const key = `dashboard:recentActivityFeed.actions.${normalized}`;
  const translated = t(key);
  const hasTranslation = translated && translated !== key && !translated.endsWith(`.${normalized}`);

  if (hasTranslation) {
    return {
      fullText: translated,
      dotColor,
      badgeColor,
    };
  }

  return {
    fullText: `${t('dashboard:recentActivityFeed.performedAction')} "${action.replace(/[._]/g, ' ')}"`,
    dotColor,
    badgeColor,
  };
}

function getTimeGroup(dateStr: string): 'today' | 'yesterday' | 'earlier' {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d >= today) return 'today';
  if (d >= yesterday) return 'yesterday';
  return 'earlier';
}

export function RecentActivityFeed() {
  const { t } = useTranslation();
  const { items, isLoading, isError, isLive } = useRecentActivityFeed();
  const { map: userNames } = useUserNameMap();
  const [isExpanded, setIsExpanded] = useState(false);

  // Giới hạn 5 mục khi chưa mở rộng
  const displayItems = isExpanded ? items : items.slice(0, 5);

  // Phân nhóm hoạt động theo thời gian: Hôm nay, Hôm qua, Trước đó
  const groupedItems = useMemo(() => {
    const groups: { key: 'today' | 'yesterday' | 'earlier'; title: string; list: RecentActivityItem[] }[] = [
      { key: 'today', title: t('dashboard:recentActivityFeed.groups.today'), list: [] },
      { key: 'yesterday', title: t('dashboard:recentActivityFeed.groups.yesterday'), list: [] },
      { key: 'earlier', title: t('dashboard:recentActivityFeed.groups.earlier'), list: [] },
    ];

    displayItems.forEach((item) => {
      const gKey = getTimeGroup(item.createdAt);
      const targetGroup = groups.find((g) => g.key === gKey) ?? groups[2];
      targetGroup.list.push(item);
    });

    return groups.filter((g) => g.list.length > 0);
  }, [displayItems, t]);

  return (
    <div>
      {/* Header trạng thái Live */}
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {isLive && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          </span>
          <span className="text-xs font-medium text-slate-500">
            {isLive ? t('dashboard:recentActivityFeed.live') : t('dashboard:recentActivityFeed.offline')}
          </span>
        </div>
        <span className="text-[11px] text-slate-400 font-normal">
          {t('dashboard:recentActivityFeed.eventCount', { count: items.length, defaultValue: `${items.length} sự kiện gần đây` })}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : isError ? (
        <EmptyState title={t('dashboard:recentActivityFeed.errorTitle')} />
      ) : items.length === 0 ? (
        <EmptyState title={t('dashboard:recentActivityFeed.emptyTitle')} description={t('dashboard:recentActivityFeed.emptyDescription')} />
      ) : (
        <div className="space-y-5">
          {groupedItems.map((group) => (
            <div key={group.key} className="space-y-3">
              {/* Tiêu đề nhóm ngày */}
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-slate-100/80 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                  {group.title}
                </span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              {/* Danh sách Timeline dọc */}
              <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-slate-200/70">
                {group.list.map((item) => {
                  const actorName = (item.actorId ? userNames[item.actorId] : undefined) ?? t('dashboard:recentActivityFeed.unknownActor');
                  const { fullText, dotColor, badgeColor } = getActionDisplay(item.action, t);

                  return (
                    <div key={item.id} className="group relative flex items-start gap-3 transition-all duration-150">
                      {/* Chấm tròn Timeline định vị theo ngữ cảnh */}
                      <span
                        className={`absolute -left-[19px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white shadow-sm transition-transform duration-200 group-hover:scale-125 ${dotColor}`}
                      />

                      <Avatar name={actorName} size="sm" className="h-7 w-7 shrink-0 text-xs shadow-sm ring-1 ring-slate-100" />

                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-900">{actorName}</span>
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${badgeColor}`}>
                            {fullText}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400 font-medium">{formatRelativeTime(item.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Nút mở rộng / Xem tất cả hoạt động */}
          {items.length > 5 && (
            <div className="pt-2 text-center border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 hover:bg-primary-50/70 transition-all duration-200"
              >
                <span>{isExpanded ? t('dashboard:recentActivityFeed.collapse') : t('dashboard:recentActivityFeed.viewAll')}</span>
                <ChevronDownIcon
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
