import { Draggable } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/Card';
import { AvatarStack } from '@/components/ui/Avatar';
import { CalendarIcon } from '@/components/ui/Icons';
import { cn, formatDate } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { isOverdue } from '../utils';
import type { Task } from '@/types';

export function TaskCard({ task, index, onClick }: { task: Task; index: number; onClick: () => void }) {
  const { map: userNames } = useUserNameMap();
  const overdue = isOverdue(task.dueDate, task.status);
  const assigneeNames = (task.assignees ?? []).map((a) => a.fullName ?? userNames[a.userId] ?? 'Thành viên');

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
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
