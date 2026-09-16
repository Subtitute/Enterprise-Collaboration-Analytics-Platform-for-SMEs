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

const COLUMN_ACCENT: Record<DealStage, string> = {
  NEW: 'bg-slate-300',
  CONTACTED: 'bg-primary-400',
  PROPOSAL: 'bg-primary-500',
  NEGOTIATION: 'bg-amber-500',
  WON: 'bg-emerald-500',
  LOST: 'bg-rose-400',
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

  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStage = destination.droppableId as DealStage;
    if (newStage !== source.droppableId) {
      updateStage.mutate({ dealId: draggableId, stage: newStage });
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
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg border border-slate-200 hover:bg-white hover:text-indigo-600 hover:scale-110 active:scale-95 transition-all cursor-pointer"
            aria-label={t('crm:kanban.scrollLeftAriaLabel')}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
        )}

        {/* Nút mũi tên cuộn sang phải (Báo hiệu còn nội dung bên phải) */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByAmount(280)}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg border border-slate-200 hover:bg-white hover:text-indigo-600 hover:scale-110 active:scale-95 transition-all cursor-pointer animate-pulse hover:animate-none"
            aria-label={t('crm:kanban.scrollRightAriaLabel')}
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
          className="flex 2xl:grid 2xl:grid-cols-6 gap-3.5 overflow-x-auto pb-3 pt-1 select-none cursor-grab active:cursor-grabbing scroll-smooth"
        >
          {DEAL_STAGES.map((stage) => {
            const columnDeals = deals.filter((d) => d.stage === stage);
            return (
              <div key={stage} className="flex w-64 min-w-[240px] 2xl:w-full shrink-0 flex-col rounded-2xl border border-slate-200/80 bg-slate-50 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-slate-200/80 px-3.5 py-3 bg-slate-100/60 rounded-t-2xl">
                  <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', COLUMN_ACCENT[stage])} />
                  <p className="text-xs font-bold text-slate-700 truncate" title={t(`crm:enums.dealStage.${stage}`)}>
                    {t(`crm:enums.dealStage.${stage}`)}
                  </p>
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200/80 shadow-2xs shrink-0">
                    {columnDeals.length}
                  </span>
                </div>
                <Droppable droppableId={stage}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn('flex-1 space-y-2.5 p-3 transition-colors min-h-[140px]', snapshot.isDraggingOver && 'bg-primary-50/50')}
                    >
                      {columnDeals.length === 0 && !snapshot.isDraggingOver ? (
                        <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400">
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
