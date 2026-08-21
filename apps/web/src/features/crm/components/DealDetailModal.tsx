import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FormField, Input } from '@/components/ui/Input';
import { TrashIcon } from '@/components/ui/Icons';
import type { Deal } from '@/types';
import { dealStageBadgeVariant } from '../utils';
import { useDeleteDeal, useUpdateDeal } from '../hooks';

/**
 * Modal xem/sua thong tin 1 deal (Wireframe.md muc 12) - mirror TaskDetailModal.tsx (features/
 * projects) ve cau truc chung, nhung KHONG co binh luan/lich su (ngoai pham vi CRM-lite dot nay).
 * Doi giai doan (stage) CHI thuc hien qua keo-tha tren Kanban (xem DealKanbanBoard.tsx), khong co
 * o modal nay - tranh 2 noi cung sua 1 gia tri theo 2 co che khac nhau (drag vs form).
 */
export function DealDetailModal({
  customerId,
  deal,
  onClose,
}: {
  customerId: string;
  deal: Deal | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateDeal = useUpdateDeal(customerId, deal?.id ?? '');
  const deleteDeal = useDeleteDeal(customerId);

  useEffect(() => {
    if (!deal) return;
    setTitle(deal.title);
    setValue(String(deal.value ?? 0));
    setExpectedCloseDate(deal.expectedCloseDate ? deal.expectedCloseDate.slice(0, 10) : '');
  }, [deal]);

  if (!deal) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    updateDeal.mutate({
      title: title.trim(),
      value: value ? Number(value) : undefined,
      expectedCloseDate: expectedCloseDate || undefined,
    });
  }

  return (
    <>
      <Modal open={Boolean(deal)} onClose={onClose} title="Chi tiết deal">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="flex items-center justify-between">
            <Badge variant={dealStageBadgeVariant(deal.stage)}>{t(`crm:enums.dealStage.${deal.stage}`)}</Badge>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50"
              aria-label="Xoá deal"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
          <FormField label="Tiêu đề" htmlFor="deal-detail-title">
            <Input id="deal-detail-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Giá trị (VND)" htmlFor="deal-detail-value">
            <Input id="deal-detail-value" type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
          </FormField>
          <FormField label="Ngày dự kiến chốt" htmlFor="deal-detail-expected-close-date">
            <Input
              id="deal-detail-expected-close-date"
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Đóng
            </Button>
            <Button type="submit" isLoading={updateDeal.isPending}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteDeal.mutate(deal.id);
          setConfirmDelete(false);
          onClose();
        }}
        title="Xoá deal này?"
        description={`Deal "${deal.title}" sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá deal"
        danger
      />
    </>
  );
}
