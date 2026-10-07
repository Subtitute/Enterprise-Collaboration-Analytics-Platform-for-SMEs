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
  const overdue = !isDone && isOverdue(task.dueDate, task.status);
  const assigneeNames = (task.assignees ?? []).map((a) => a.fullName ?? userNames[a.userId] ?? t('projects:taskCard.unknownAssignee'));

  // Xác định màu chấm ưu tiên (tương tự phẩm chất item trong Terraria/game RPG)
  // Đọc từ task.priority nếu có, hoặc tính toán dựa trên độ khẩn cấp/hạn chót
  const rawPriority = ((task as unknown as Record<string, unknown>).priority as string)?.toUpperCase();
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
          className="select-none mb-2 last:mb-0 focus:outline-none scroll-mt-24"
        >
          <div
            className={cn(
              'relative cursor-pointer rounded-radius-md border border-border-subtle bg-white p-3 shadow-none transition-all duration-150',
              isHighlighted && 'ring-2 ring-accent border-accent bg-accent-soft/30 animate-pulse',
              isDone
                ? 'opacity-100 hover:border-border-strong'
                : 'hover:border-border-strong active:scale-[0.99]',
              snapshot.isDragging && '!shadow-md !border-border-strong !opacity-60',
            )}
          >
            {/* Tín hiệu ưu tiên tối giản */}
            {priorityColor && !isDone && (
              <span
                className={cn('absolute top-3 right-3 h-1.5 w-1.5 rounded-full shrink-0', priorityColor)}
                title={rawPriority || (overdue ? t('projects:taskCard.overdue') : undefined)}
              />
            )}

            <p
              className={cn(
                'text-[13px] leading-snug line-clamp-2 pr-2.5',
                isDone ? 'text-text-secondary font-normal line-through' : 'text-text-primary font-medium',
              )}
            >
              {task.title}
            </p>

            <div className="mt-2.5 flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[11px] font-medium text-text-tertiary tabular-nums shrink-0">
                  #{task.id ? task.id.slice(-4).toUpperCase() : index + 1}
                </span>
                {task.dueDate && (
                  <span
                    className={cn(
                      'flex items-center gap-1 font-mono text-[11px] font-medium tabular-nums shrink-0',
                      isDone
                        ? 'text-text-tertiary line-through'
                        : overdue
                        ? 'text-[#B3261E]'
                        : 'text-text-tertiary',
                    )}
                  >
                    <CalendarIcon className="h-3 w-3 stroke-1.5" /> {formatDate(task.dueDate)}
                  </span>
                )}
              </div>
              {assigneeNames.length > 0 && (
                <div className="flex items-center -space-x-1.5 overflow-hidden shrink-0">
                  {assigneeNames.slice(0, 3).map((name, i) => {
                    const initials = name
                      .split(' ')
                      .map((p: string) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    return (
                      <div
                        key={i}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-accent text-[9px] font-semibold ring-1 ring-white"
                        title={name}
                      >
                        {initials}
                      </div>
                    );
                  })}
                  {assigneeNames.length > 3 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-bg-subtle text-[9px] font-mono font-medium text-text-secondary ring-1 ring-white">
                      +{assigneeNames.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
