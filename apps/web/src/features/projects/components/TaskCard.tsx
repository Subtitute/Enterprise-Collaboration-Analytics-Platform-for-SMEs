import { Draggable } from '@hello-pangea/dnd';
import { useTranslation } from 'react-i18next';
import { AvatarStack } from '@/components/ui/Avatar';
import { CalendarIcon } from '@/components/ui/Icons';
import { cn, formatDate } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { isOverdue } from '../utils';
import type { Task } from '@/types';

interface TaskCardProps {
  task: Task;
  index: number;
  onClick: () => void;
  isHighlighted?: boolean;
}

export function TaskCard({ task, index, onClick, isHighlighted = false }: TaskCardProps) {
  const { t } = useTranslation();
  const { map: userNames } = useUserNameMap();
  const isDone = task.status === 'DONE';
  const now = Date.now();
  const dueTimestamp = task.dueDate ? new Date(task.dueDate).getTime() : null;
  const isOverdueTask = !isDone && dueTimestamp !== null && dueTimestamp < now;
  const isDueSoon = !isDone && dueTimestamp !== null && dueTimestamp >= now && dueTimestamp - now <= 24 * 60 * 60 * 1000;
  const overdue = isOverdueTask;
  const assigneeNames = (task.assignees ?? []).map((a) => a.fullName ?? userNames[a.userId] ?? t('projects:taskCard.unknownAssignee'));

  // Đọc từ metadata hoặc trực tiếp
  const metaPriority = (() => {
    try {
      const stored = JSON.parse(localStorage.getItem('ec_tasks_metadata') || '{}');
      return stored[task.id]?.priority;
    } catch {
      return undefined;
    }
  })();
  const rawPriority = (metaPriority || (task as unknown as Record<string, unknown>).priority as string)?.toUpperCase();
  const priorityColor =
    rawPriority === 'URGENT' || rawPriority === 'CRITICAL'
      ? 'bg-rose-500 ring-rose-200'
      : rawPriority === 'HIGH'
      ? 'bg-amber-500 ring-amber-200'
      : rawPriority === 'MEDIUM'
      ? 'bg-sky-500 ring-sky-200'
      : rawPriority === 'LOW'
      ? 'bg-emerald-500 ring-emerald-200'
      : overdue
      ? 'bg-rose-500 ring-rose-200'
      : null;

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          id={`task-card-${task.id}`}
          style={provided.draggableProps.style}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onClick();
          }}
          className="select-none mb-2.5 last:mb-0 focus:outline-none scroll-mt-24"
        >
          <div
            className={cn(
              'relative cursor-pointer rounded-md border p-3 transition-colors duration-150',
              isHighlighted && 'ring-1 ring-slate-900 border-slate-900 bg-slate-50/50',
              isDone
                ? 'border-slate-200/60 bg-slate-50/60 text-slate-400 hover:border-slate-300'
                : 'border-slate-200/90 bg-white hover:border-slate-400',
              snapshot.isDragging && '!border-slate-900 shadow-md !opacity-100',
            )}
          >
            {/* Tín hiệu ưu tiên tối giản: Chấm vi mô 6px ở góc thẻ */}
            {priorityColor && !isDone && (
              <span
                className={cn('absolute top-3 right-3 h-1.5 w-1.5 rounded-full shrink-0', priorityColor)}
                title={rawPriority || (overdue ? t('projects:taskCard.overdue') : undefined)}
              />
            )}

            <p
              className={cn(
                'text-sm font-semibold leading-snug line-clamp-2 pr-3',
                isDone ? 'text-slate-400 line-through' : 'text-slate-900',
              )}
            >
              {task.title}
            </p>
            <div className="mt-2.5 flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={cn(
                    'font-mono text-[11px] font-semibold tabular-nums shrink-0',
                    isDone ? 'text-slate-300' : 'text-slate-400',
                  )}
                >
                  #{task.id ? task.id.slice(-4).toUpperCase() : index + 1}
                </span>
                {task.dueDate && (
                  <span
                    className={cn(
                      'flex items-center gap-1 text-[11px] font-mono tabular-nums px-1.5 py-0.2 rounded-sm shrink-0 font-medium',
                      isDone
                        ? 'text-slate-400 line-through bg-slate-100'
                        : isOverdueTask
                        ? 'text-rose-700 bg-rose-50 border border-rose-200 font-semibold'
                        : isDueSoon
                        ? 'text-amber-700 bg-amber-50 border border-amber-200 font-semibold'
                        : 'text-slate-500 bg-slate-50 border border-slate-200/60',
                    )}
                  >
                    <CalendarIcon className="h-3 w-3" /> {formatDate(task.dueDate)}
                  </span>
                )}
              </div>
              {assigneeNames.length > 0 && (
                <div className="shrink-0">
                  <AvatarStack names={assigneeNames} max={3} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
