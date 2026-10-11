import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '@/types';

export interface KanbanColumnProps {
  status: TaskStatus;
  columnTasks: Task[];
  onTaskClick: (task: Task) => void;
  onQuickAdd?: (status: TaskStatus) => void;
  highlightedTaskId?: string | null;
}

export const KanbanColumn = React.memo(function KanbanColumn({
  status,
  columnTasks,
  onTaskClick,
  onQuickAdd,
  highlightedTaskId,
}: KanbanColumnProps) {
  const { t } = useTranslation();

  const statusDotColor =
    status === 'DONE'
      ? 'bg-[#2F6F44]'
      : status === 'DOING'
      ? 'bg-[#1E5A8A]'
      : 'bg-[#8A8781]';

  return (
    <div className="flex w-[82vw] min-w-[280px] max-w-[340px] shrink-0 flex-col rounded-radius-md rounded-xl bg-canvas border border-border-subtle p-3 lg:w-auto lg:max-w-none lg:shrink">
      {/* Header cột — KHÔNG CÓ VIỀN TRÊN ĐỈNH */}
      <div className="flex items-center gap-2 px-1 pb-3">
        <span className={cn('h-2 w-2 rounded-full shrink-0', statusDotColor)} />
        <p className="text-[13px] font-semibold text-text-primary leading-none">
          {t(`projects:enums.taskStatus.${status}`)}
        </p>
        <span className="ml-auto rounded-[4px] bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-text-secondary border border-border-subtle shadow-none tabular-nums leading-none">
          {columnTasks.length}
        </span>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 pt-1 pb-1 transition-colors min-h-[140px]',
              snapshot.isDraggingOver && 'bg-accent-soft/40 rounded-radius-sm',
            )}
          >
            {columnTasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onClick={() => onTaskClick(task)}
                isHighlighted={task.id === highlightedTaskId}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Nút thêm nhanh công việc ở đáy cột (§3.4) — Ghost button, không nền, không viền dashed */}
      {status !== 'DONE' && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onQuickAdd?.(status)}
            className="flex w-full items-center justify-start gap-1.5 h-8 px-2 rounded-radius-sm text-[13px] font-medium text-text-secondary hover:text-text-primary hover:bg-white/80 transition-colors cursor-pointer"
          >
            <PlusIcon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            <span>{t('projects:detail.newTask', 'Thêm công việc')}</span>
          </button>
        </div>
      )}
    </div>
  );
});

