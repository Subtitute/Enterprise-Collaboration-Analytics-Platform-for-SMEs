import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { formatRelativeTime } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { t } from '@/i18n';
import { useRecentActivityFeed } from '../hooks';

// 21/08/2026: `describeAction` la ham NGOAI component (module-level) - khong the goi
// useTranslation() (vi pham Rules of Hooks). Dung tham chieu `t` khong-qua-hook tu i18n/index.ts,
// giong pattern `statusLabel` trong TaskStatusDonut.tsx.
function describeAction(action: string): string {
  // Gia tri "action" chinh la `eventType` tho tu Kafka (packages/common-dto/src/events/event-types.ts,
  // vd 'task.status_changed'), duoc chuan hoa sang cau tieng Viet de doc de hon; fallback an toan
  // (hien nguyen chuoi, thay dau cham/gach duoi bang khoang trang) neu gap gia tri chua biet.
  // Dau '.'/'_' trong eventType duoc thay bang '_' de dung lam key JSON (i18next dung '.' lam
  // keySeparator nen khong the giu nguyen dau cham trong key).
  const key = action.replace(/[._]/g, '_');
  return t(`dashboard:recentActivityFeed.actions.${key}`, { defaultValue: action.replace(/[._]/g, ' ') });
}

export function RecentActivityFeed() {
  const { t } = useTranslation();
  const { items, isLoading, isError, isLive } = useRecentActivityFeed();
  const { map: userNames } = useUserNameMap();

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        <span className="text-xs text-slate-400">{isLive ? t('dashboard:recentActivityFeed.live') : t('dashboard:recentActivityFeed.offline')}</span>
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
        <ul className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
          {items.map((item) => {
            const actorName = (item.actorId ? userNames[item.actorId] : undefined) ?? t('dashboard:recentActivityFeed.unknownActor');
            return (
              <li key={item.id} className="flex items-start gap-3">
                <Avatar name={actorName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium text-slate-900">{actorName}</span> {describeAction(item.action)}
                  </p>
                  <p className="text-xs text-slate-400">{formatRelativeTime(item.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
