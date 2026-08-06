import { Draggable } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/Card';
import { CalendarIcon } from '@/components/ui/Icons';
import { cn, formatDate } from '@/lib/utils';
import { formatDealValue } from '../utils';
import type { Deal } from '@/types';

export function DealCard({ deal, index, onClick }: { deal: Deal; index: number; onClick: () => void }) {
  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onClick();
          }}
          className={cn(
            'cursor-pointer select-none p-3 shadow-none hover:border-primary-300 hover:shadow-card',
            snapshot.isDragging && 'rotate-1 shadow-xl',
          )}
        >
          <p className="text-sm font-medium leading-snug text-slate-800">{deal.title}</p>
          <p className="mt-1 text-sm font-semibold text-primary-700">{formatDealValue(deal.value)}</p>
          {deal.expectedCloseDate && (
            <span className="mt-2 flex items-center gap-1 text-xs text-slate-400">
              <CalendarIcon className="h-3.5 w-3.5" /> {formatDate(deal.expectedCloseDate)}
            </span>
          )}
        </Card>
      )}
    </Draggable>
  );
}
