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
          style={provided.draggableProps.style}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onClick();
          }}
          className="select-none mb-2.5 last:mb-0 focus:outline-none"
        >
          <div
            className={cn(
              'relative cursor-pointer rounded-xl border p-3 shadow-sm shadow-slate-900/5 transition-all duration-150',
              // Giao diện mặc định & Hiệu ứng chìm cho task đã Hoàn thành
              isDone
                ? 'border-slate-200/60 bg-slate-50/80 text-slate-500 opacity-80 hover:opacity-100 hover:bg-slate-50 hover:border-indigo-300'
                : 'border-slate-200/80 bg-white hover:border-indigo-300 hover:shadow-md active:scale-[0.98]',
              snapshot.isDragging && '!shadow-xl !border-primary-400 ring-2 ring-primary-500/20 !opacity-100',
            )}
          >
            {/* Tín hiệu ưu tiên tối giản: Chấm màu siêu nhỏ ở góc thẻ (Terraria style) */}
            {priorityColor && !isDone && (
              <span
                className={cn('absolute top-3 right-3 h-1.5 w-1.5 rounded-full ring-2 shrink-0', priorityColor)}
                title={rawPriority || (overdue ? 'Quá hạn' : undefined)}
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
            <div className="mt-2 flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    'font-mono text-[11px] font-semibold shrink-0',
                    isDone ? 'text-slate-300' : 'text-slate-400',
                  )}
                >
                  #{task.id ? task.id.slice(-4).toUpperCase() : index + 1}
                </span>
                {task.dueDate && (
                  <span
                    className={cn(
                      'flex items-center gap-1 text-xs shrink-0',
                      isDone
                        ? 'text-slate-300 line-through'
                        : overdue
                        ? 'font-medium text-rose-600'
                        : 'text-slate-400',
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" /> {formatDate(task.dueDate)}
                  </span>
                )}
              </div>
              {assigneeNames.length > 0 && (
                <div className={cn(isDone && 'opacity-60 grayscale')}>
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
