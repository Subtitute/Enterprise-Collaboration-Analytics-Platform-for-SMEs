import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { TASK_STATUSES, TASK_STATUS_LABEL_VI } from '@/types';
import type { Task, TaskStatus } from '@/types';
import { TaskCard } from './TaskCard';
import { useUpdateTaskStatus } from '../hooks';

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  TODO: 'bg-slate-300',
  DOING: 'bg-primary-500',
  DONE: 'bg-emerald-500',
};

export function KanbanBoard({ projectId, tasks, onTaskClick }: { projectId: string; tasks: Task[]; onTaskClick: (task: Task) => void }) {
  const updateStatus = useUpdateTaskStatus(projectId);

  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId as TaskStatus;
    if (newStatus !== source.droppableId) {
      updateStatus.mutate({ taskId: draggableId, status: newStatus });
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TASK_STATUSES.map((status) => {
          const columnTasks = tasks.filter((t) => t.status === status);
          return (
            <div key={status} className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center gap-2 border-b border-slate-200 px-3.5 py-2.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', COLUMN_ACCENT[status])} />
                <p className="text-sm font-semibold text-slate-700">{TASK_STATUS_LABEL_VI[status]}</p>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                  {columnTasks.length}
                </span>
              </div>
              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn('flex-1 space-y-2.5 p-3 transition-colors', snapshot.isDraggingOver && 'bg-primary-50/50')}
                    style={{ minHeight: 120 }}
                  >
                    {columnTasks.map((task, index) => (
                      <TaskCard key={task.id} task={task} index={index} onClick={() => onTaskClick(task)} />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
