import { Draggable } from '@hello-pangea/dnd';
import { Card } from '@/components/ui/Card';
import { CalendarIcon } from '@/components/ui/Icons';
import { cn, formatDate } from '@/lib/utils';
import { formatDealValue } from '../utils';
import type { Deal } from '@/types';

export function DealCard({ deal, index, onClick }: { deal: Deal; index: number; onClick: () => void }) {
  // Tính toán trạng thái sát hạn (<= 3 ngày) hoặc quá hạn
  const isUrgentOrOverdue = (() => {
    if (!deal.expectedCloseDate) return false;
    // Chuẩn hóa chuỗi ngày dạng YYYY-MM-DD
    const rawDateStr = deal.expectedCloseDate.includes('T')
      ? deal.expectedCloseDate.split('T')[0]
      : deal.expectedCloseDate.slice(0, 10);
    const [y, m, d] = rawDateStr.split('-').map(Number);
    if (!y || !m || !d) return false;

    const targetDay = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Số ngày còn lại (dương: chưa tới hạn, 0: hôm nay, âm: quá hạn)
    const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
  })();

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
            'cursor-pointer select-none rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md',
            snapshot.isDragging && 'rotate-1 shadow-xl ring-2 ring-indigo-500/20',
          )}
        >
          <p className="text-sm font-medium leading-snug text-slate-800">{deal.title}</p>
          <p className="mt-1 text-sm font-semibold text-primary-700">{formatDealValue(deal.value)}</p>
          {deal.expectedCloseDate && (
            <span
              className={cn(
                'mt-2 flex items-center gap-1 text-xs',
                isUrgentOrOverdue
                  ? 'font-medium text-rose-600'
                  : 'text-slate-400',
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" /> {formatDate(deal.expectedCloseDate)}
            </span>
          )}
        </Card>
      )}
    </Draggable>
  );
}
