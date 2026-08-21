import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useTranslation } from 'react-i18next';
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
      <div className="flex gap-4 overflow-x-auto pb-1">
        {DEAL_STAGES.map((stage) => {
          const columnDeals = deals.filter((d) => d.stage === stage);
          return (
            <div key={stage} className="flex w-64 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center gap-2 border-b border-slate-200 px-3.5 py-2.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', COLUMN_ACCENT[stage])} />
                <p className="text-sm font-semibold text-slate-700">{t(`crm:enums.dealStage.${stage}`)}</p>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                  {columnDeals.length}
                </span>
              </div>
              <Droppable droppableId={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn('flex-1 space-y-2.5 p-3 transition-colors', snapshot.isDraggingOver && 'bg-primary-50/50')}
                    style={{ minHeight: 120 }}
                  >
                    {columnDeals.map((deal, index) => (
                      <DealCard key={deal.id} deal={deal} index={index} onClick={() => onDealClick(deal)} />
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
