// 16/10/2026: Modal sửa 1 giao dịch mua hàng (CustomerPurchase) đã ghi nhận - CHỈ cho sửa
// note/purchasedAt (backend chỉ cho phép sửa đúng 2 trường này, sản phẩm/số lượng/đơn giá bất biến
// theo thiết kế vì đã gắn với tồn kho đã trừ lúc tạo - không dựng UI sửa 2 trường đó). Việc xoá
// tách riêng (ConfirmDialog ở CustomerPurchaseHistory.tsx), mirror cách CustomerCard.tsx tách
// EditCustomerModal/ConfirmDialog thành 2 hành động độc lập (khác DealDetailModal gộp chung) - cần
// thiết ở đây vì CUSTOMER_PURCHASE_UPDATE/CUSTOMER_PURCHASE_DELETE là 2 quyền tách biệt.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { useUpdateCustomerPurchase } from '@/features/inventory/hooks';
import type { CustomerPurchase } from '@/types';

export function EditCustomerPurchaseModal({
  purchase,
  onClose,
}: {
  purchase: CustomerPurchase | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const [purchasedAt, setPurchasedAt] = useState('');
  // 16/10/2026: useUpdateCustomerPurchase(id) nhan id qua closure (xac nhan truc tiep tai
  // features/inventory/hooks.ts cua nhanh cong viec kia) - mirror dung cach DealDetailModal.tsx
  // dung useUpdateDeal(customerId, deal?.id ?? ''), goi TRUOC nhanh return som ben duoi vi hook
  // khong duoc goi co dieu kien.
  const updatePurchase = useUpdateCustomerPurchase(purchase?.id ?? '');

  useEffect(() => {
    if (!purchase) return;
    setNote(purchase.note ?? '');
    setPurchasedAt(purchase.purchasedAt ? purchase.purchasedAt.slice(0, 10) : '');
  }, [purchase]);

  if (!purchase) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    updatePurchase.mutate(
      {
        note: note.trim() || undefined,
        purchasedAt,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal
      open={Boolean(purchase)}
      onClose={onClose}
      preventCloseWhilePending={updatePurchase.isPending}
      title={t('crm:editCustomerPurchaseModal.title')}
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-border-strong text-text-secondary hover:bg-canvas hover:text-text-primary rounded-radius-sm h-9"
            onClick={onClose}
            disabled={updatePurchase.isPending}
          >
            {t('crm:editCustomerPurchaseModal.cancel')}
          </Button>
          <Button
            type="submit"
            form="edit-customer-purchase-form"
            className="bg-primary hover:bg-primary-hover text-primary-contrast rounded-radius-sm h-9"
            isLoading={updatePurchase.isPending}
          >
            {t('crm:editCustomerPurchaseModal.save')}
          </Button>
        </div>
      }
    >
      <form id="edit-customer-purchase-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('crm:editCustomerPurchaseModal.fieldDate')} htmlFor="edit-purchase-date">
          <DatePicker id="edit-purchase-date" value={purchasedAt} onChange={setPurchasedAt} position="top" />
        </FormField>
        <FormField label={t('crm:editCustomerPurchaseModal.fieldNote')} htmlFor="edit-purchase-note">
          <Textarea id="edit-purchase-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}
