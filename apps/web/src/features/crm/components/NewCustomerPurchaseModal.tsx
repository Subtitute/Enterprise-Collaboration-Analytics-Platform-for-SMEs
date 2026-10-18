// 16/10/2026: Modal "Ghi nhận giao dịch" - ghi nhận 1 CustomerPurchase (gán mặt hàng cho khách
// hàng, Danh mục sản phẩm + Kho, Technical_Spec.md mục 22) ngay trên trang Chi tiết khách hàng.
// Chỉ thu thập đúng các trường người dùng thực sự chọn (sản phẩm/số lượng/ngày/ghi chú/kho xuất
// hàng tùy chọn) - đơn giá tại thời điểm mua (unitPriceAtPurchase) do backend tự chốt từ giá hiện
// tại của sản phẩm, không có ô nhập giá ở đây. Mirror cấu trúc NewDealModal.tsx (cùng thư mục).
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { DatePicker } from '@/components/ui/DatePicker';
import { getTodayGmt7DateString, unwrapList } from '@/lib/utils';
import { useCreateCustomerPurchase, useProductsQuery, useWarehousesQuery } from '@/features/inventory/hooks';
import type { Product, Warehouse } from '@/types';

export function NewCustomerPurchaseModal({ customerId, open, onClose }: { customerId: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [purchasedAt, setPurchasedAt] = useState(getTodayGmt7DateString());
  const [warehouseId, setWarehouseId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const productsQuery = useProductsQuery({ limit: 200 });
  const warehousesQuery = useWarehousesQuery();
  const products = unwrapList<Product>(productsQuery.data);
  const warehouses = unwrapList<Warehouse>(warehousesQuery.data);
  const createPurchase = useCreateCustomerPurchase();

  function reset() {
    setProductId('');
    setQuantity('1');
    setPurchasedAt(getTodayGmt7DateString());
    setWarehouseId('');
    setNote('');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!productId) {
      setError(t('crm:newCustomerPurchaseModal.productRequiredError'));
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError(t('crm:newCustomerPurchaseModal.quantityRequiredError'));
      return;
    }
    if (!purchasedAt) {
      setError(t('crm:newCustomerPurchaseModal.dateRequiredError'));
      return;
    }
    createPurchase.mutate(
      {
        customerId,
        productId,
        quantity: qty,
        purchasedAt,
        note: note.trim() || undefined,
        warehouseId: warehouseId || undefined,
      },
      { onSuccess: handleClose },
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      preventCloseWhilePending={createPurchase.isPending}
      title={t('crm:newCustomerPurchaseModal.title')}
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-border-strong text-text-secondary hover:bg-canvas hover:text-text-primary rounded-radius-sm h-9"
            onClick={handleClose}
            disabled={createPurchase.isPending}
          >
            {t('crm:newCustomerPurchaseModal.cancel')}
          </Button>
          <Button
            type="submit"
            form="new-customer-purchase-form"
            className="bg-primary hover:bg-primary-hover text-primary-contrast rounded-radius-sm h-9"
            isLoading={createPurchase.isPending}
          >
            {t('crm:newCustomerPurchaseModal.submit')}
          </Button>
        </div>
      }
    >
      <form id="new-customer-purchase-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('crm:newCustomerPurchaseModal.fieldProduct')} htmlFor="purchase-product" error={error} required>
          <CustomFilterSelect
            value={productId}
            onChange={(val) => {
              setProductId(val);
              setError('');
            }}
            position="top"
            ariaLabel={t('crm:newCustomerPurchaseModal.fieldProduct')}
            options={[
              { value: '', label: t('crm:newCustomerPurchaseModal.productPlaceholder') },
              ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
            ]}
          />
        </FormField>
        <FormField label={t('crm:newCustomerPurchaseModal.fieldQuantity')} htmlFor="purchase-quantity">
          <Input
            id="purchase-quantity"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="rounded-radius-sm border-border-strong focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          />
        </FormField>
        <FormField label={t('crm:newCustomerPurchaseModal.fieldDate')} htmlFor="purchase-date">
          <DatePicker id="purchase-date" value={purchasedAt} onChange={setPurchasedAt} position="top" />
        </FormField>
        <FormField label={t('crm:newCustomerPurchaseModal.fieldWarehouse')} htmlFor="purchase-warehouse" hint={t('crm:newCustomerPurchaseModal.warehouseHint')}>
          <CustomFilterSelect
            value={warehouseId}
            onChange={setWarehouseId}
            position="top"
            ariaLabel={t('crm:newCustomerPurchaseModal.fieldWarehouse')}
            options={[
              { value: '', label: t('crm:newCustomerPurchaseModal.noWarehouseOption') },
              ...warehouses.map((w) => ({ value: w.id, label: w.name })),
            ]}
          />
        </FormField>
        <FormField label={t('crm:newCustomerPurchaseModal.fieldNote')} htmlFor="purchase-note">
          <Textarea
            id="purchase-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('crm:newCustomerPurchaseModal.notePlaceholder')}
          />
        </FormField>
      </form>
    </Modal>
  );
}
