import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { CalendarIcon } from '@/components/ui/Icons';
import { cn, formatDate } from '@/lib/utils';
import { formatDealValue } from '../utils';
import type { Deal } from '@/types';

export const DealCard = React.memo(function DealCard({ deal, index, onClick }: { deal: Deal; index: number; onClick: () => void }) {
  // Tính toán trạng thái sát hạn (<= 3 ngày) hoặc quá hạn
  const isUrgentOrOverdue = (() => {
    // 15/09/2026: bo qua deal da o trang thai cuoi (WON/LOST) - deal da chot xong thi ngay du kien
    // chot cu (co the da qua) khong con y nghia "sap qua han" nua, tranh hien nham mau do canh bao.
    if (deal.stage === 'WON' || deal.stage === 'LOST') return false;
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
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onClick();
          }}
          className={cn(
            'cursor-pointer select-none rounded-radius-sm border border-border-subtle bg-white p-3 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
            snapshot.isDragging && 'opacity-60 cursor-grabbing',
          )}
        >
          <p className="line-clamp-2 text-[13px] leading-5 font-medium text-text-primary">{deal.title}</p>
          <p className="mt-1 font-mono text-[14px] font-medium text-accent tabular-nums">{formatDealValue(deal.value)}</p>
          {deal.expectedCloseDate && (
            <span
              className={cn(
                'mt-2 flex items-center gap-1 font-mono text-[12px] tabular-nums',
                isUrgentOrOverdue
                  ? 'font-medium text-[#B3261E]'
                  : 'text-text-tertiary',
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5 stroke-1.5" /> {formatDate(deal.expectedCloseDate)}
            </span>
          )}
        </div>
      )}
    </Draggable>
  );
});

