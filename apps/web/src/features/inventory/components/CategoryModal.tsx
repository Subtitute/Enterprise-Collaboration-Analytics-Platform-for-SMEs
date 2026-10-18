// 16/10/2026: Modal tao/sua 1 danh muc san pham - mirror features/admin/components/DepartmentModal.tsx
// (ket hop ca 2 che do trong 1 file qua prop `category` optional). Duoc mo tu
// ManageCategoriesModal.tsx (modal tren modal, cung mau voi DealDetailModal.tsx + ConfirmDialog).
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { useCreateProductCategory, useUpdateProductCategory } from '../hooks';
import type { ProductCategory } from '@/types';

export function CategoryModal({
  open,
  onClose,
  category,
}: {
  open: boolean;
  onClose: () => void;
  category?: ProductCategory | null;
}) {
  const { t } = useTranslation();
  const isEditing = Boolean(category);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const createCategory = useCreateProductCategory();
  const updateCategory = useUpdateProductCategory(category?.id ?? '');

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '');
      setDescription(category?.description ?? '');
      setError('');
    }
  }, [open, category]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('inventory:categoryModal.nameRequiredError'));
      return;
    }
    const payload = { name: name.trim(), description: description.trim() || undefined };
    if (isEditing && category) {
      updateCategory.mutate(payload, { onSuccess: onClose });
    } else {
      createCategory.mutate(payload, { onSuccess: onClose });
    }
  }

  const isPending = createCategory.isPending || updateCategory.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      preventCloseWhilePending={isPending}
      title={isEditing ? t('inventory:categoryModal.editTitle') : t('inventory:categoryModal.createTitle')}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="h-9 rounded-radius-sm border-border-strong text-[13px]">
            {t('inventory:categoryModal.cancel')}
          </Button>
          <Button
            type="submit"
            form="category-form"
            isLoading={isPending}
            className="h-9 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium"
          >
            {isEditing ? t('inventory:categoryModal.save') : t('inventory:categoryModal.create')}
          </Button>
        </div>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('inventory:categoryModal.fieldName')} htmlFor="category-name" error={error} required>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('inventory:categoryModal.namePlaceholder')}
          />
        </FormField>
        <FormField label={t('inventory:categoryModal.fieldDescription')} htmlFor="category-description">
          <Textarea id="category-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}
