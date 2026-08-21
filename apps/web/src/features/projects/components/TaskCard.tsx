import { Draggable } from '@hello-pangea/dnd';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { AvatarStack } from '@/components/ui/Avatar';
import { CalendarIcon } from '@/components/ui/Icons';
import { cn, formatDate } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { isOverdue } from '../utils';
import type { Task } from '@/types';

export function TaskCard({ task, index, onClick }: { task: Task; index: number; onClick: () => void }) {
  const { t } = useTranslation();
  const { map: userNames } = useUserNameMap();
  const overdue = isOverdue(task.dueDate, task.status);
  const assigneeNames = (task.assignees ?? []).map((a) => a.fullName ?? userNames[a.userId] ?? t('projects:taskCard.unknownAssignee'));

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          // 25/07/2026: them onKeyDown (Enter) de nguoi dung dung ban phim mo duoc Modal chi tiet
          // cong viec - truoc ban sua nay the chi co onClick, khong the "kich hoat" bang ban phim.
          // An toan de them rieng: kieu DraggableProvidedDragHandleProps cua @hello-pangea/dnd
          // KHONG co san onKeyDown (chi co data-rfd-*, role, tabIndex, draggable, onDragStart) -
          // thao tac "nhac" (lift)/di chuyen bang phim Space/mui ten cua thu vien duoc gan qua
          // addEventListener native rieng, khong di qua prop React nay, nen khong co xung dot ghi
          // de can xu ly. Chi bat Enter (khong dung Space) de tranh dung tram len nghia Space cua
          // thu vien du hai co che nay doc lap voi nhau.
          onKeyDown={(e) => {
            if (e.key === 'Enter') onClick();
          }}
          className={cn(
            'cursor-pointer select-none p-3 shadow-none hover:border-primary-300 hover:shadow-card',
            snapshot.isDragging && 'rotate-1 shadow-xl',
          )}
        >
          <p className="text-sm font-medium leading-snug text-slate-800">{task.title}</p>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            {task.dueDate ? (
              <span className={cn('flex items-center gap-1 text-xs', overdue ? 'font-medium text-rose-600' : 'text-slate-400')}>
                <CalendarIcon className="h-3.5 w-3.5" /> {formatDate(task.dueDate)}
              </span>
            ) : (
              <span />
            )}
            {assigneeNames.length > 0 && <AvatarStack names={assigneeNames} max={3} />}
          </div>
        </Card>
      )}
    </Draggable>
  );
}
