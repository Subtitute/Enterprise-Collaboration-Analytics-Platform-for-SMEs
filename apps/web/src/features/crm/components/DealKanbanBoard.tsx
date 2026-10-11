import { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { DEAL_STAGES } from '@/types';
import type { Deal, DealStage } from '@/types';
import { DealCard } from './DealCard';
import { useUpdateDealStage } from '../hooks';

// Dot màu theo spec §3.2:
// NEW text-tertiary #8A8781
// CONTACTED info #1E5A8A
// PROPOSAL accent #0E5E5E
// NEGOTIATION warning #B45309
// WON success #2F6F44
// LOST error #B3261E
const STAGE_DOT_COLOR: Record<DealStage, string> = {
  NEW: 'bg-[#8A8781]',
  CONTACTED: 'bg-[#1E5A8A]',
  PROPOSAL: 'bg-[#0E5E5E]',
  NEGOTIATION: 'bg-[#B45309]',
  WON: 'bg-[#2F6F44]',
  LOST: 'bg-[#B3261E]',
};

/**
 * Kanban pipeline ban hang (Wireframe.md muc 12) - mirror KanbanBoard.tsx (features/projects).
 * Khac voi Task (3 cot, tuyen tinh), Deal co 6 cot va 4 cot dau di chuyen tu do qua lai lan nhau -
 * validate chuyen giai doan hop le hoan toan o backend (DealsService.updateStage), frontend chi
 * goi mutation va hien loi qua toast neu backend tu choi (xem useUpdateDealStage).
 */
export function DealKanbanBoard({ customerId, deals, onDealClick }: { customerId: string; deals: Deal[]; onDealClick: (deal: Deal) => void }) {
  const { t } = useTranslation();
  const updateStage = useUpdateDealStage(customerId);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function checkScroll() {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  }

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [deals]);

  function scrollByAmount(offset: number) {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  }

  // Xử lý giữ trỏ chuột trái để kéo cuộn ngang bảng Kanban (Mouse Drag-to-scroll)
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
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
    const walk = (x - startXRef.current) * 1.2;
    scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
    checkScroll();
  }

  function handleMouseUpOrLeave() {
    isMouseDownRef.current = false;
  }

  const orderStorageKey = `crm_deal_order_${customerId}`;

  // Khởi tạo và đồng bộ danh sách deals theo từng cột dựa trên dealOrder lưu trữ
  const [columns, setColumns] = useState<Record<DealStage, Deal[]>>(() => {
    const savedOrder: string[] = (() => {
      try {
        return JSON.parse(localStorage.getItem(orderStorageKey) || '[]');
      } catch {
        return [];
      }
    })();

    const result: Record<DealStage, Deal[]> = {
      NEW: [],
      CONTACTED: [],
      PROPOSAL: [],
      NEGOTIATION: [],
      WON: [],
      LOST: [],
    };
    DEAL_STAGES.forEach((stage) => {
      const colDeals = deals.filter((d) => d.stage === stage);
      result[stage] = [...colDeals].sort((a, b) => {
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

  // Đồng bộ lại khi danh sách deals từ server/parent thay đổi
  useEffect(() => {
    const savedOrder: string[] = (() => {
      try {
        return JSON.parse(localStorage.getItem(orderStorageKey) || '[]');
      } catch {
        return [];
      }
    })();

    const result: Record<DealStage, Deal[]> = {
      NEW: [],
      CONTACTED: [],
      PROPOSAL: [],
      NEGOTIATION: [],
      WON: [],
      LOST: [],
    };
    DEAL_STAGES.forEach((stage) => {
      const colDeals = deals.filter((d) => d.stage === stage);
      result[stage] = [...colDeals].sort((a, b) => {
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
  }, [deals, orderStorageKey]);

  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceStage = source.droppableId as DealStage;
    const destStage = destination.droppableId as DealStage;

    const sourceList = Array.from(columns[sourceStage]);
    const destList = sourceStage === destStage ? sourceList : Array.from(columns[destStage]);

    const [movedDeal] = sourceList.splice(source.index, 1);
    if (!movedDeal) return;

    const updatedDeal = { ...movedDeal, stage: destStage };
    destList.splice(destination.index, 0, updatedDeal);

    const newColumns = {
      ...columns,
      [sourceStage]: sourceList,
      [destStage]: destList,
    };

    // Cập nhật State Cục bộ NGAY LẬP TỨC để thẻ rơi trúng đích 100% không bị nhảy vị trí
    setColumns(newColumns);

    // Lưu thứ tự hiển thị ưu tiên người dùng vào LocalStorage
    try {
      const allOrderedIds = DEAL_STAGES.flatMap((stage) => newColumns[stage].map((d) => d.id));
      localStorage.setItem(orderStorageKey, JSON.stringify(allOrderedIds));
    } catch {
      // Bỏ qua lỗi hạn ngạch storage nếu có
    }

    // Nếu đổi sang cột khác: gọi backend cập nhật stage
    if (destStage !== sourceStage) {
      updateStage.mutate({ dealId: draggableId, stage: destStage });
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="relative group/board">
        {/* Nút mũi tên cuộn sang trái */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByAmount(-280)}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white text-text-primary shadow-md border border-border-strong hover:bg-bg-subtle transition-colors cursor-pointer"
            aria-label={t('crm:kanban.scrollLeftAriaLabel')}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
        )}

        {/* Nút mũi tên cuộn sang phải */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByAmount(280)}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white text-text-primary shadow-md border border-border-strong hover:bg-bg-subtle transition-colors cursor-pointer"
            aria-label={t('crm:kanban.scrollRightAriaLabel')}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="flex 2xl:grid 2xl:grid-cols-6 gap-3 overflow-x-auto pb-3 pt-1 select-none cursor-grab active:cursor-grabbing scroll-smooth"
        >
          {DEAL_STAGES.map((stage) => {
            const columnDeals = columns[stage] ?? [];
            return (
              <div key={stage} className="flex w-64 min-w-[240px] 2xl:w-full shrink-0 flex-col rounded-radius-lg bg-[#F7F6F3] p-3">
                {/* Header: dot 8px + tên stage 13/600 text-primary + badge đếm mono 12/500 căn phải */}
                <div className="flex items-center gap-2 pb-2.5">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', STAGE_DOT_COLOR[stage])} />
                  <p className="text-[13px] font-semibold text-text-primary truncate" title={t(`crm:enums.dealStage.${stage}`)}>
                    {t(`crm:enums.dealStage.${stage}`)}
                  </p>
                  <span className="ml-auto font-mono text-[12px] font-medium text-text-tertiary tabular-nums shrink-0">
                    {columnDeals.length}
                  </span>
                </div>
                <Droppable droppableId={stage}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn('flex-1 space-y-2.5 transition-colors min-h-[140px]', snapshot.isDraggingOver && 'bg-accent-soft/40 rounded-radius-sm')}
                    >
                      {columnDeals.length === 0 && !snapshot.isDraggingOver ? (
                        <div className="flex h-24 items-center justify-center rounded-radius-sm border border-dashed border-border-subtle text-[12px] text-text-tertiary">
                          {t('crm:kanban.emptyColumn')}
                        </div>
                      ) : (
                        columnDeals.map((deal, index) => (
                          <DealCard key={deal.id} deal={deal} index={index} onClick={() => onDealClick(deal)} />
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}
