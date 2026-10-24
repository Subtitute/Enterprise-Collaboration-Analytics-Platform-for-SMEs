import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { Deal, DealStage } from '@/types';
import { DealCard } from './DealCard';

// Dot màu theo spec §3.2:
// NEW text-tertiary #8A8781
// CONTACTED info #1E5A8A
// PROPOSAL accent #0E5E5E
// NEGOTIATION warning #B45309
// WON success #2F6F44
// LOST error #B3261E
export const STAGE_DOT_COLOR: Record<DealStage, string> = {
  NEW: 'bg-[#8A8781]',
  CONTACTED: 'bg-[#1E5A8A]',
  PROPOSAL: 'bg-[#0E5E5E]',
  NEGOTIATION: 'bg-[#B45309]',
  WON: 'bg-[#2F6F44]',
  LOST: 'bg-[#B3261E]',
};

interface PipelineColumnProps {
  stage: DealStage;
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
}

export const PipelineColumn = React.memo(function PipelineColumn({
  stage,
  deals,
  onDealClick,
}: PipelineColumnProps) {
  const { t } = useTranslation();

  return (
    <div className="flex w-64 min-w-[240px] 2xl:w-full shrink-0 flex-col rounded-radius-lg rounded-xl bg-[#F7F6F3] p-3">
      {/* Header: dot 8px + tên stage 13/600 text-primary + badge đếm mono 12/500 căn phải */}
      <div className="flex items-center gap-2 pb-2.5">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', STAGE_DOT_COLOR[stage])} />
        <p className="text-[13px] font-semibold text-text-primary truncate" title={t(`crm:enums.dealStage.${stage}`)}>
          {t(`crm:enums.dealStage.${stage}`)}
        </p>
        <span className="ml-auto font-mono text-[12px] font-medium text-text-tertiary tabular-nums shrink-0">
          {deals.length}
        </span>
      </div>
      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn('flex-1 space-y-2.5 transition-colors min-h-[140px]', snapshot.isDraggingOver && 'bg-accent-soft/40 rounded-radius-sm')}
          >
            {deals.length === 0 && !snapshot.isDraggingOver ? (
              <div className="flex h-24 items-center justify-center rounded-radius-sm border border-dashed border-border-subtle text-[12px] text-text-tertiary">
                {t('crm:kanban.emptyColumn')}
              </div>
            ) : (
              deals.map((deal, index) => (
                <DealCard key={deal.id} deal={deal} index={index} onClick={() => onDealClick(deal)} />
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
});

