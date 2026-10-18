// 16/10/2026: Modal "Ghi nhận biến động" kho (POST /stock-movements) - nguoi dung luon nhap SO
// LUONG DUONG (truc quan hon), component tu tinh dau truoc khi goi API: IN -> +so luong, OUT ->
// -so luong, ADJUSTMENT -> dau theo chieu nguoi dung chon rieng (fieldDirection). Day la lop phong
// thu PHIA CLIENT - backend van la noi thuc thi quy tac dau that su (xem CreateStockMovementPayload
// tai api.ts).
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { useCreateStockMovement, useProductsQuery, useWarehousesQuery } from '../hooks';
import type { StockMovementType } from '@/types';

type Direction = 'increase' | 'decrease';

export function RecordStockMovementModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [type, setType] = useState<StockMovementType>('IN');
  const [direction, setDirection] = useState<Direction>('increase');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [warehouseError, setWarehouseError] = useState('');
  const [productError, setProductError] = useState('');
  const [quantityError, setQuantityError] = useState('');

  const warehousesQuery = useWarehousesQuery({ page: 1, limit: 100 });
  const productsQuery = useProductsQuery({ page: 1, limit: 100 });
  const warehouses = warehousesQuery.data?.data ?? [];
  const products = productsQuery.data?.data ?? [];

  const createMovement = useCreateStockMovement();

  useEffect(() => {
    if (open) {
      setWarehouseId('');
      setProductId('');
      setType('IN');
      setDirection('increase');
      setQuantity('');
      setNote('');
      setWarehouseError('');
      setProductError('');
      setQuantityError('');
    }
  }, [open]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    let hasError = false;
    if (!warehouseId) {
      setWarehouseError(t('inventory:recordStockMovementModal.warehouseRequiredError'));
      hasError = true;
    } else {
      setWarehouseError('');
    }
    if (!productId) {
      setProductError(t('inventory:recordStockMovementModal.productRequiredError'));
      hasError = true;
    } else {
      setProductError('');
    }
    const qty = parseInt(quantity, 10);
    if (!quantity || Number.isNaN(qty) || qty <= 0) {
      setQuantityError(t('inventory:recordStockMovementModal.quantityRequiredError'));
      hasError = true;
    } else {
      setQuantityError('');
    }
    if (hasError) return;

    const quantityDelta = type === 'IN' ? qty : type === 'OUT' ? -qty : direction === 'increase' ? qty : -qty;

    createMovement.mutate(
      { warehouseId, productId, type, quantityDelta, note: note.trim() || undefined },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      preventCloseWhilePending={createMovement.isPending}
      title={t('inventory:recordStockMovementModal.title')}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={createMovement.isPending} className="h-9 rounded-radius-sm border-border-strong text-[13px]">
            {t('inventory:recordStockMovementModal.cancel')}
          </Button>
          <Button
            type="submit"
            form="stock-movement-form"
            isLoading={createMovement.isPending}
            className="h-9 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium"
          >
            {t('inventory:recordStockMovementModal.submit')}
          </Button>
        </div>
      }
    >
      <form id="stock-movement-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('inventory:recordStockMovementModal.fieldWarehouse')} htmlFor="movement-warehouse" error={warehouseError} required>
          <CustomFilterSelect
            value={warehouseId}
            onChange={setWarehouseId}
            position="top"
            ariaLabel={t('inventory:recordStockMovementModal.fieldWarehouse')}
            options={[
              { value: '', label: t('inventory:recordStockMovementModal.warehousePlaceholder') },
              ...warehouses.map((w) => ({ value: w.id, label: w.name })),
            ]}
          />
        </FormField>
        <FormField label={t('inventory:recordStockMovementModal.fieldProduct')} htmlFor="movement-product" error={productError} required>
          <CustomFilterSelect
            value={productId}
            onChange={setProductId}
            position="top"
            ariaLabel={t('inventory:recordStockMovementModal.fieldProduct')}
            options={[
              { value: '', label: t('inventory:recordStockMovementModal.productPlaceholder') },
              ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
            ]}
          />
        </FormField>
        <FormField label={t('inventory:recordStockMovementModal.fieldType')} htmlFor="movement-type" required>
          <CustomFilterSelect
            value={type}
            onChange={(v) => setType(v as StockMovementType)}
            position="top"
            ariaLabel={t('inventory:recordStockMovementModal.fieldType')}
            options={[
              { value: 'IN', label: t('inventory:enums.stockMovementType.IN') },
              { value: 'OUT', label: t('inventory:enums.stockMovementType.OUT') },
              { value: 'ADJUSTMENT', label: t('inventory:enums.stockMovementType.ADJUSTMENT') },
            ]}
          />
        </FormField>
        {type === 'ADJUSTMENT' && (
          <FormField label={t('inventory:recordStockMovementModal.fieldDirection')} htmlFor="movement-direction" required>
            <CustomFilterSelect
              value={direction}
              onChange={(v) => setDirection(v as Direction)}
              position="top"
              ariaLabel={t('inventory:recordStockMovementModal.fieldDirection')}
              options={[
                { value: 'increase', label: t('inventory:recordStockMovementModal.directionIncrease') },
                { value: 'decrease', label: t('inventory:recordStockMovementModal.directionDecrease') },
              ]}
            />
          </FormField>
        )}
        <FormField label={t('inventory:recordStockMovementModal.fieldQuantity')} htmlFor="movement-quantity" error={quantityError} required>
          <Input
            id="movement-quantity"
            type="text"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            className="text-right font-mono text-[14px] leading-5 font-medium tabular-nums"
          />
        </FormField>
        <FormField label={t('inventory:recordStockMovementModal.fieldNote')} htmlFor="movement-note">
          <Textarea id="movement-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}
