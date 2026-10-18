// 16/10/2026: Modal tao/sua 1 kho - mirror CategoryModal.tsx/DepartmentModal.tsx (ket hop ca 2 che
// do trong 1 file qua prop `warehouse` optional).
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { useCreateWarehouse, useUpdateWarehouse } from '../hooks';
import type { Warehouse } from '@/types';

export function WarehouseModal({
  open,
  onClose,
  warehouse,
}: {
  open: boolean;
  onClose: () => void;
  warehouse?: Warehouse | null;
}) {
  const { t } = useTranslation();
  const isEditing = Boolean(warehouse);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse(warehouse?.id ?? '');

  useEffect(() => {
    if (open) {
      setName(warehouse?.name ?? '');
      setAddress(warehouse?.address ?? '');
      setError('');
    }
  }, [open, warehouse]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('inventory:warehouseModal.nameRequiredError'));
      return;
    }
    const payload = { name: name.trim(), address: address.trim() || undefined };
    if (isEditing && warehouse) {
      updateWarehouse.mutate(payload, { onSuccess: onClose });
    } else {
      createWarehouse.mutate(payload, { onSuccess: onClose });
    }
  }

  const isPending = createWarehouse.isPending || updateWarehouse.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      preventCloseWhilePending={isPending}
      title={isEditing ? t('inventory:warehouseModal.editTitle') : t('inventory:warehouseModal.createTitle')}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="h-9 rounded-radius-sm border-border-strong text-[13px]">
            {t('inventory:warehouseModal.cancel')}
          </Button>
          <Button
            type="submit"
            form="warehouse-form"
            isLoading={isPending}
            className="h-9 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium"
          >
            {isEditing ? t('inventory:warehouseModal.save') : t('inventory:warehouseModal.create')}
          </Button>
        </div>
      }
    >
      <form id="warehouse-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('inventory:warehouseModal.fieldName')} htmlFor="warehouse-name" error={error} required>
          <Input
            id="warehouse-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('inventory:warehouseModal.namePlaceholder')}
          />
        </FormField>
        <FormField label={t('inventory:warehouseModal.fieldAddress')} htmlFor="warehouse-address">
          <Input id="warehouse-address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}
