import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/Icons';
import { TASK_STATUSES } from '@/types';
import type { Task, TaskStatus } from '@/types';
import { KanbanColumn } from './KanbanColumn';
import { useUpdateTaskStatus } from '../hooks';

interface KanbanBoardProps {
  projectId: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onQuickAdd?: (status: TaskStatus) => void;
  highlightedTaskId?: string | null;
}

export const KanbanBoard = React.memo(function KanbanBoard({
  projectId,
  tasks,
  onTaskClick,
  onQuickAdd,
  highlightedTaskId,
}: KanbanBoardProps) {
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
            className="lg:hidden absolute left-1 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 border border-[#E5E4E0] hover:bg-[#E4EFEE] hover:text-[#0E5E5E] active:scale-95 transition-all cursor-pointer"
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
            className="lg:hidden absolute right-1 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 border border-[#E5E4E0] hover:bg-[#E4EFEE] hover:text-[#0E5E5E] active:scale-95 transition-all cursor-pointer animate-pulse hover:animate-none"
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
          className="flex w-full gap-4 overflow-x-auto pb-3 pt-1 cursor-grab active:cursor-grabbing select-none lg:grid lg:grid-cols-3 lg:gap-4 lg:overflow-visible lg:pb-0 scroll-smooth"
        >
          {TASK_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              columnTasks={columns[status] ?? []}
              onTaskClick={onTaskClick}
              onQuickAdd={onQuickAdd}
              highlightedTaskId={highlightedTaskId}
            />
          ))}
        </div>
      </div>
    </DragDropContext>
  );
});
