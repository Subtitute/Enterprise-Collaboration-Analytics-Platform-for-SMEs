import { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useTranslation } from 'react-i18next';
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/Icons';
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

interface KanbanBoardProps {
  projectId: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onQuickAdd?: (status: TaskStatus) => void;
  highlightedTaskId?: string | null;
}

export function KanbanBoard({ projectId, tasks, onTaskClick, onQuickAdd, highlightedTaskId }: KanbanBoardProps) {
  const { t } = useTranslation();
  const updateStatus = useUpdateTaskStatus(projectId);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceStatus = source.droppableId as TaskStatus;
    const destStatus = destination.droppableId as TaskStatus;

    const sourceList = Array.from(columns[sourceStatus]);
    const destList = sourceStatus === destStatus ? sourceList : Array.from(columns[destStatus]);

    const [movedTask] = sourceList.splice(source.index, 1);
    if (!movedTask) return;

    const updatedTask = { ...movedTask, status: destStatus };
    destList.splice(destination.index, 0, updatedTask);

    const newColumns = {
      ...columns,
      [sourceStatus]: sourceList,
      [destStatus]: destList,
    };

    // Cập nhật State Cục bộ NGAY LẬP TỨC để thẻ rơi trúng đích 100% không bị nhảy vị trí
    setColumns(newColumns);

    // Lưu thứ tự hiển thị toàn bộ vào localStorage
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

    // Nếu chuyển cột thì gọi API cập nhật Backend
    if (sourceStatus !== destStatus) {
      updateStatus.mutate({ taskId: draggableId, status: destStatus });
      // 22/09/2026: thông báo "Task Done" cho người phụ trách dự án giờ được Project-Task Service
      // tự động phát qua Kafka ngay trong updateStatus() ở trên - không cần gọi gì thêm ở đây.
    }
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
              <div key={status} className="flex w-[82vw] min-w-[280px] max-w-[340px] shrink-0 flex-col rounded-2xl bg-slate-100/90 lg:w-auto lg:max-w-none lg:shrink">
                <div
                  className={cn(
                    'flex items-center gap-2 px-4 py-3.5 border-b-2',
                    status === 'TODO' && 'border-b-slate-200/80',
                    status === 'DOING' && 'border-b-primary-500/50',
                    status === 'DONE' && 'border-b-emerald-500/50',
                  )}
                >
                  <span className={cn('h-2.5 w-2.5 rounded-full ring-2 ring-white', COLUMN_ACCENT[status])} />
                  <p className="text-sm font-bold text-slate-800">{t(`projects:enums.taskStatus.${status}`)}</p>
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-700 border border-slate-200/80 shadow-2xs">
                    {columnTasks.length}
                  </span>
                </div>
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn('flex-1 p-3 transition-colors', snapshot.isDraggingOver && 'bg-primary-50/50')}
                      style={{ minHeight: 120 }}
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

                {/* Nút thêm nhanh công việc ở đáy cột (Trello UX) - Chỉ hiển thị cho TODO và DOING */}
                {status !== 'DONE' && (
                  <div className="p-2.5 pt-0">
                    <button
                      type="button"
                      onClick={() => onQuickAdd?.(status)}
                      className="flex w-full items-center justify-start gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-all duration-150 hover:bg-white hover:text-slate-900 hover:shadow-2xs active:scale-[0.98]"
                    >
                      <PlusIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>{t('projects:detail.newTask')}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}
