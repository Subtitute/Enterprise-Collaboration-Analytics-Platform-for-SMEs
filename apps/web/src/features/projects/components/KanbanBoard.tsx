import { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useTranslation } from 'react-i18next';
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/Icons';
import { ConfirmDialog } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { TASK_STATUSES } from '@/types';
import type { Task, TaskStatus } from '@/types';
import { TaskCard } from './TaskCard';
import { useUpdateTaskStatus } from '../hooks';
import { addAssignee } from '../api';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import { useQueryClient } from '@tanstack/react-query';

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  TODO: 'bg-slate-300',
  DOING: 'bg-primary-500',
  DONE: 'bg-emerald-500',
};

interface KanbanBoardProps {
  projectId: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onQuickAdd?: (status: TaskStatus) => void;
  highlightedTaskId?: string | null;
  isLead?: boolean;
  canManage?: boolean;
}

export function KanbanBoard({
  projectId,
  tasks,
  onTaskClick,
  onQuickAdd,
  highlightedTaskId,
  isLead = false,
  canManage = false,
}: KanbanBoardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const updateStatus = useUpdateTaskStatus(projectId);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [pendingReopen, setPendingReopen] = useState<{
    task: Task;
    destStatus: TaskStatus;
    destIndex: number;
    sourceStatus: TaskStatus;
    sourceIndex: number;
  } | null>(null);

  function checkScroll() {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }

  function scrollByAmount(offset: number) {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  }

  const orderStorageKey = `ec_project_${projectId}_tasks_order`;

  // Xử lý giữ trỏ chuột trái để kéo cuộn ngang bảng Kanban (Mouse Drag-to-scroll)
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    // Chỉ kích hoạt khi click vào nền trống (không phải click vào nút bấm hay thẻ Draggable đang kéo)
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-rfd-draggable-id]') || target.closest('input')) {
      return;
    }
    if (!scrollContainerRef.current) return;
    isMouseDownRef.current = true;
    startXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!isMouseDownRef.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.2; // Tốc độ trượt
    scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
    checkScroll();
  }

  function handleMouseUpOrLeave() {
    isMouseDownRef.current = false;
  }

  // Khởi tạo và đồng bộ danh sách tasks theo từng cột dựa trên taskOrder lưu trữ
  const [columns, setColumns] = useState<Record<TaskStatus, Task[]>>(() => {
    const savedOrder: string[] = (() => {
      try {
        return JSON.parse(localStorage.getItem(orderStorageKey) || '[]');
      } catch {
        return [];
      }
    })();

    const result: Record<TaskStatus, Task[]> = { TODO: [], DOING: [], DONE: [] };
    TASK_STATUSES.forEach((status) => {
      const colTasks = tasks.filter((t) => t.status === status);
      result[status] = [...colTasks].sort((a, b) => {
        const idxA = savedOrder.indexOf(a.id);
        const idxB = savedOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    });
    return result;
  });

  // Đồng bộ lại khi danh sách tasks từ server/parent thay đổi
  useEffect(() => {
    const savedOrder: string[] = (() => {
      try {
        return JSON.parse(localStorage.getItem(orderStorageKey) || '[]');
      } catch {
        return [];
      }
    })();

    const result: Record<TaskStatus, Task[]> = { TODO: [], DOING: [], DONE: [] };
    TASK_STATUSES.forEach((status) => {
      const colTasks = tasks.filter((t) => t.status === status);
      result[status] = [...colTasks].sort((a, b) => {
        const idxA = savedOrder.indexOf(a.id);
        const idxB = savedOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    });
    setColumns(result);
    checkScroll();
  }, [tasks, orderStorageKey]);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  function executeStatusMove(task: Task, sourceStatus: TaskStatus, sourceIndex: number, destStatus: TaskStatus, destIndex: number) {
    const sourceList = Array.from(columns[sourceStatus]);
    const destList = sourceStatus === destStatus ? sourceList : Array.from(columns[destStatus]);

    const [movedTask] = sourceList.splice(sourceIndex, 1);
    if (!movedTask) return;

    let updatedTask = { ...movedTask, status: destStatus };

    // Tự động gán người nhận khi kéo từ TODO sang DOING nếu chưa có assignee và là Employee
    const hasAssignee = (updatedTask.assignees && updatedTask.assignees.length > 0);
    const isEmployee = !canManage;
    if (sourceStatus === 'TODO' && destStatus === 'DOING' && !hasAssignee && isEmployee && currentUser?.id) {
      updatedTask = {
        ...updatedTask,
        assignees: [{ userId: currentUser.id, fullName: currentUser.fullName, email: currentUser.email }],
      };
      addAssignee(task.id, currentUser.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      }).catch(() => {});
      toast.info(t('projects:toast.task.autoAssigned'));
    }

    destList.splice(destIndex, 0, updatedTask);

    const newColumns = {
      ...columns,
      [sourceStatus]: sourceList,
      [destStatus]: destList,
    };

    setColumns(newColumns);

    const allTaskIds = [
      ...newColumns.TODO.map((t) => t.id),
      ...newColumns.DOING.map((t) => t.id),
      ...newColumns.DONE.map((t) => t.id),
    ];
    try {
      localStorage.setItem(orderStorageKey, JSON.stringify(allTaskIds));
    } catch {
      // ignore
    }

    if (sourceStatus !== destStatus) {
      updateStatus.mutate({ taskId: task.id, status: destStatus });
    }
  }

  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceStatus = source.droppableId as TaskStatus;
    const destStatus = destination.droppableId as TaskStatus;

    const movedTask = columns[sourceStatus][source.index];
    if (!movedTask) return;

    // Kiểm tra quy tắc Reopen: Kéo từ DONE sang DOING hoặc TODO
    if (sourceStatus === 'DONE' && destStatus !== 'DONE') {
      const canReopen = canManage || isLead;
      if (!canReopen) {
        toast.error(t('projects:toast.task.reopenDenied'));
        return;
      }

      // Quản lý / Lead: Mở ConfirmDialog trước khi thực hiện chuyển
      setPendingReopen({
        task: movedTask,
        sourceStatus,
        sourceIndex: source.index,
        destStatus,
        destIndex: destination.index,
      });
      return;
    }

    executeStatusMove(movedTask, sourceStatus, source.index, destStatus, destination.index);
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="relative group/kanban">
        {/* Nút mũi tên cuộn trái cho màn hình nhỏ */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByAmount(-300)}
            className="lg:hidden absolute left-1 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg border border-slate-200 hover:bg-white hover:text-indigo-600 hover:scale-110 active:scale-95 transition-all cursor-pointer"
            aria-label={t('projects:kanban.scrollLeftAriaLabel')}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
        )}

        {/* Nút mũi tên cuộn phải (Báo hiệu còn nội dung bên phải) */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByAmount(300)}
            className="lg:hidden absolute right-1 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg border border-slate-200 hover:bg-white hover:text-indigo-600 hover:scale-110 active:scale-95 transition-all cursor-pointer animate-pulse hover:animate-none"
            aria-label={t('projects:kanban.scrollRightAriaLabel')}
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="flex w-full gap-4 overflow-x-auto pb-3 pt-1 cursor-grab active:cursor-grabbing select-none lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:pb-0 scroll-smooth"
        >
          {TASK_STATUSES.map((status) => {
            const columnTasks = columns[status] ?? [];

            return (
              <div key={status} className="flex w-[82vw] min-w-[300px] max-w-[360px] shrink-0 flex-col rounded-md border border-slate-200/80 bg-slate-100/70 lg:w-auto lg:max-w-none lg:shrink">
                <div
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-3 border-b',
                    status === 'TODO' && 'border-b-slate-200',
                    status === 'DOING' && 'border-b-indigo-200',
                    status === 'DONE' && 'border-b-emerald-200',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', COLUMN_ACCENT[status])} />
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t(`projects:enums.taskStatus.${status}`)}</p>
                  <span className="ml-auto rounded-sm bg-white px-1.5 py-0.2 font-mono text-[11px] font-bold text-slate-600 border border-slate-200/80 tabular-nums">
                    {columnTasks.length}
                  </span>
                </div>
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn('flex-1 p-2.5 transition-colors', snapshot.isDraggingOver && 'bg-indigo-50/40')}
                      style={{ minHeight: 120 }}
                    >
                      {columnTasks.length === 0 && !snapshot.isDraggingOver ? (
                        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-200/80 py-8 px-4 text-center my-1">
                          <p className="text-xs font-medium text-slate-400">
                            {t('projects:kanban.emptyColumn')}
                          </p>
                        </div>
                      ) : (
                        columnTasks.map((task, index) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            index={index}
                            onClick={() => onTaskClick(task)}
                            isHighlighted={task.id === highlightedTaskId}
                          />
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Nút thêm nhanh công việc ở chân mỗi cột Kanban */}
                <div className="p-2 pt-0">
                  <button
                    type="button"
                    onClick={() => onQuickAdd?.(status)}
                    className="flex w-full items-center justify-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-white hover:text-slate-800 hover:border hover:border-slate-200/80 active:scale-[0.98] cursor-pointer"
                  >
                    <PlusIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>{t('projects:detail.newTask')}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pendingReopen && (
        <ConfirmDialog
          open={Boolean(pendingReopen)}
          onClose={() => setPendingReopen(null)}
          onConfirm={() => {
            executeStatusMove(
              pendingReopen.task,
              pendingReopen.sourceStatus,
              pendingReopen.sourceIndex,
              pendingReopen.destStatus,
              pendingReopen.destIndex,
            );
            setPendingReopen(null);
          }}
          title={t('projects:kanban.confirmReopenTitle')}
          description={t('projects:kanban.confirmReopenDescription', { title: pendingReopen.task.title })}
          confirmLabel={t('projects:kanban.confirmReopenButton')}
        />
      )}
    </DragDropContext>
  );
}
