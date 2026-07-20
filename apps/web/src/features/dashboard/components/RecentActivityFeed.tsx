import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { formatRelativeTime } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useRecentActivityFeed } from '../hooks';

function describeAction(action: string): string {
  // Gia tri "action" chinh la `eventType` tho tu Kafka (packages/common-dto/src/events/event-types.ts,
  // vd 'task.status_changed'), duoc chuan hoa sang cau tieng Viet de doc de hon; fallback an toan
  // (hien nguyen chuoi, thay dau cham/gach duoi bang khoang trang) neu gap gia tri chua biet.
  const map: Record<string, string> = {
    'iam.organization.registered': 'đã đăng ký tổ chức mới',
    'iam.user.registered': 'đã tham gia tổ chức',
    'iam.user.deactivated': 'đã bị vô hiệu hóa tài khoản',
    'task.created': 'đã tạo một công việc mới',
    'task.status_changed': 'đã cập nhật trạng thái công việc',
    'task.assigned': 'đã được giao một công việc',
    'project.created': 'đã tạo một dự án mới',
    'project.completed': 'đã hoàn thành một dự án',
    'document.uploaded': 'đã tải lên một tài liệu',
    'document.shared': 'đã chia sẻ một tài liệu',
    'document.deleted': 'đã xóa một tài liệu',
  };
  return map[action] ?? action.replace(/[._]/g, ' ');
}

export function RecentActivityFeed() {
  const { items, isLoading, isError, isLive } = useRecentActivityFeed();
  const { map: userNames } = useUserNameMap();

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        <span className="text-xs text-slate-400">{isLive ? 'Đang cập nhật trực tiếp' : 'Ngoại tuyến'}</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : isError ? (
        <EmptyState title="Không thể tải hoạt động gần đây" />
      ) : items.length === 0 ? (
        <EmptyState title="Chưa có hoạt động nào" description="Hoạt động mới trong tổ chức sẽ hiển thị tại đây theo thời gian thực." />
      ) : (
        <ul className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
          {items.map((item) => {
            const actorName = (item.actorId ? userNames[item.actorId] : undefined) ?? 'Một thành viên';
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
