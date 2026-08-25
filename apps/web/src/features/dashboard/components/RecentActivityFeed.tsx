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
  verb: string;
  target?: string;
  dotColor: string;
}

function parseActionDetails(action: string): ActionDisplay {
  const normalized = action.replace(/[._]/g, '_').toLowerCase();

  switch (normalized) {
    case 'iam_organization_registered':
      return { verb: 'đã đăng ký', target: 'tổ chức mới', dotColor: 'bg-emerald-500 ring-emerald-100' };
    case 'iam_user_registered':
      return { verb: 'đã tham gia', target: 'tổ chức', dotColor: 'bg-blue-500 ring-blue-100' };
    case 'iam_user_deactivated':
      return { verb: 'đã vô hiệu hóa', target: 'tài khoản thành viên', dotColor: 'bg-rose-500 ring-rose-100' };
    case 'task_created':
      return { verb: 'đã tạo', target: 'công việc mới', dotColor: 'bg-amber-500 ring-amber-100' };
    case 'task_status_changed':
      return { verb: 'đã cập nhật trạng thái', target: 'công việc', dotColor: 'bg-indigo-500 ring-indigo-100' };
    case 'task_assigned':
      return { verb: 'đã được giao', target: 'công việc', dotColor: 'bg-sky-500 ring-sky-100' };
    case 'project_created':
      return { verb: 'đã khởi tạo', target: 'dự án mới', dotColor: 'bg-violet-500 ring-violet-100' };
    case 'project_completed':
      return { verb: 'đã hoàn thành', target: 'dự án', dotColor: 'bg-emerald-600 ring-emerald-100' };
    case 'document_uploaded':
      return { verb: 'đã tải lên', target: 'tài liệu mới', dotColor: 'bg-purple-500 ring-purple-100' };
    case 'document_shared':
      return { verb: 'đã chia sẻ', target: 'tài liệu', dotColor: 'bg-teal-500 ring-teal-100' };
    case 'document_deleted':
      return { verb: 'đã xóa', target: 'tài liệu', dotColor: 'bg-rose-500 ring-rose-100' };
    default:
      return { verb: 'đã thực hiện thao tác', target: action.replace(/[._]/g, ' '), dotColor: 'bg-slate-400 ring-slate-100' };
  }
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
          {items.length} sự kiện gần đây
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
                  const { verb, target, dotColor } = parseActionDetails(item.action);

                  return (
                    <div key={item.id} className="group relative flex items-start gap-3 transition-all duration-150">
                      {/* Chấm tròn Timeline định vị */}
                      <span
                        className={`absolute -left-[19px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white shadow-sm transition-transform duration-200 group-hover:scale-125 ${dotColor}`}
                      />

                      <Avatar name={actorName} size="sm" className="h-7 w-7 shrink-0 text-xs shadow-sm ring-1 ring-slate-100" />

                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                          <span className="font-bold text-slate-900">{actorName}</span>{' '}
                          <span className="text-slate-600">{verb}</span>{' '}
                          {target && <span className="font-semibold text-slate-800">"{target}"</span>}
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
