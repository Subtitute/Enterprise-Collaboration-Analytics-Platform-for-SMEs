import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { TASK_STATUSES } from '@/types';
import type { Task, TaskStatus } from '@/types';
import { TaskCard } from './TaskCard';
import { useUpdateTaskStatus } from '../hooks';

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  TODO: 'bg-slate-300',
  DOING: 'bg-primary-500',
  DONE: 'bg-emerald-500',
};

export function KanbanBoard({ projectId, tasks, onTaskClick }: { projectId: string; tasks: Task[]; onTaskClick: (task: Task) => void }) {
  const { t } = useTranslation();
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
      {/* Duoi 768px: cuon ngang theo cot (moi cot rong co dinh) thay vi xep doc - dung theo dung
          yeu cau "bang Kanban cuon ngang theo cot" o Wireframe.md muc 10. Tu md tro len chuyen
          sang grid 3 cot nhu cu (khong cuon). */}
      <div className="flex gap-4 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
        {TASK_STATUSES.map((status) => {
          const columnTasks = tasks.filter((task) => task.status === status);
          return (
            <div key={status} className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50/60 md:w-auto md:shrink">
              <div className="flex items-center gap-2 border-b border-slate-200 px-3.5 py-2.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', COLUMN_ACCENT[status])} />
                <p className="text-sm font-semibold text-slate-700">{t(`projects:enums.taskStatus.${status}`)}</p>
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
