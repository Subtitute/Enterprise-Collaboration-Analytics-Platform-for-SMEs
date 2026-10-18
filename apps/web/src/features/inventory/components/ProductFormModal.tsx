// 16/10/2026: Modal tao/sua 1 san pham (ket hop ca 2 che do trong 1 file, mirror
// features/admin/components/DepartmentModal.tsx - prop `product` optional: co gia tri = che do
// sua, khong co = che do tao moi). Phan tai/doi/xoa anh (POST|DELETE /products/:id/image) CHI hien
// o che do sua - anh chi upload duoc SAU KHI san pham da co id (khong the kem trong POST /products).
import { useEffect, useRef, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { Spinner } from '@/components/ui/Spinner';
import { AlertCircleIcon, PackageIcon, UploadIcon } from '@/components/ui/Icons';
import { cn, formatBytes } from '@/lib/utils';
import { useCreateProduct, useProductCategoriesQuery, useRemoveProductImage, useSetProductImage, useUpdateProduct } from '../hooks';
import { MAX_PRODUCT_IMAGE_SIZE_BYTES, validateProductImageFile } from '../api';
import type { Product } from '@/types';

export function ProductFormModal({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
}) {
  const { t } = useTranslation();
  const isEditing = Boolean(product);

  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [nameError, setNameError] = useState('');
  const [skuError, setSkuError] = useState('');
  const [imageError, setImageError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmRemoveImage, setConfirmRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoriesQuery = useProductCategoriesQuery({ page: 1, limit: 100 });
  const categories = categoriesQuery.data?.data ?? [];

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(product?.id ?? '');
  const setImage = useSetProductImage();
  const removeImage = useRemoveProductImage();

  useEffect(() => {
    if (open) {
      setCategoryId(product?.categoryId ?? '');
      setName(product?.name ?? '');
      setSku(product?.sku ?? '');
      setDescription(product?.description ?? '');
      setUnitPrice(product?.unitPrice ? new Intl.NumberFormat('vi-VN').format(product.unitPrice) : '');
      setCategoryError('');
      setNameError('');
      setSkuError('');
      setImageError('');
      setPreviewUrl(null);
    }
  }, [open, product]);

  // Giai phong object URL (preview cuc bo) khi doi sang preview khac hoac khi modal dong/unmount -
  // tranh ro ri bo nho (xem MDN URL.revokeObjectURL).
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleUnitPriceChange(inputVal: string) {
    const rawNumber = inputVal.replace(/\D/g, '');
    if (!rawNumber) {
      setUnitPrice('');
      return;
    }
    setUnitPrice(new Intl.NumberFormat('vi-VN').format(Number(rawNumber)));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    let hasError = false;
    if (!categoryId) {
      setCategoryError(t('inventory:productFormModal.categoryRequiredError'));
      hasError = true;
    } else {
      setCategoryError('');
    }
    if (!name.trim()) {
      setNameError(t('inventory:productFormModal.nameRequiredError'));
      hasError = true;
    } else {
      setNameError('');
    }
    if (!sku.trim()) {
      setSkuError(t('inventory:productFormModal.skuRequiredError'));
      hasError = true;
    } else {
      setSkuError('');
    }
    if (hasError) return;

    const cleanPrice = unitPrice ? Number(unitPrice.replace(/\./g, '')) : undefined;
    const payload = {
      categoryId,
      name: name.trim(),
      sku: sku.trim(),
      description: description.trim() || undefined,
      unitPrice: cleanPrice,
    };

    if (isEditing && product) {
      updateProduct.mutate(payload, { onSuccess: onClose });
    } else {
      createProduct.mutate(payload, { onSuccess: onClose });
    }
  }

  function selectImageFile(file: File) {
    const err = validateProductImageFile(file);
    if (err) {
      setImageError(err);
      return;
    }
    setImageError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    if (!product) return;
    setImage.mutate({ id: product.id, file }, { onError: () => setPreviewUrl(null) });
  }

  function handleImageDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) selectImageFile(dropped);
  }

  const isPending = createProduct.isPending || updateProduct.isPending;
  const displayedImageUrl = previewUrl ?? product?.imageUrl ?? null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        preventCloseWhilePending={isPending}
        title={isEditing ? t('inventory:productFormModal.editTitle') : t('inventory:productFormModal.createTitle')}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="h-9 rounded-radius-sm border-border-strong text-[13px]">
              {t('inventory:productFormModal.cancel')}
            </Button>
            <Button
              type="submit"
              form="product-form"
              isLoading={isPending}
              className="h-9 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium"
            >
              {isEditing ? t('inventory:productFormModal.save') : t('inventory:productFormModal.create')}
            </Button>
          </div>
        }
      >
        <form id="product-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormField label={t('inventory:productFormModal.fieldCategory')} htmlFor="product-category" error={categoryError} required>
            <CustomFilterSelect
              value={categoryId}
              onChange={setCategoryId}
              position="top"
              ariaLabel={t('inventory:productFormModal.fieldCategory')}
              options={[
                { value: '', label: t('inventory:productFormModal.categoryPlaceholder') },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </FormField>
          <FormField label={t('inventory:productFormModal.fieldName')} htmlFor="product-name" error={nameError} required>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('inventory:productFormModal.namePlaceholder')}
            />
          </FormField>
          <FormField label={t('inventory:productFormModal.fieldSku')} htmlFor="product-sku" error={skuError} required>
            <Input
              id="product-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder={t('inventory:productFormModal.skuPlaceholder')}
              className="font-mono"
            />
          </FormField>
          <FormField label={t('inventory:productFormModal.fieldUnitPrice')} htmlFor="product-unit-price">
            <div className="relative">
              <Input
                id="product-unit-price"
                type="text"
                inputMode="numeric"
                value={unitPrice}
                onChange={(e) => handleUnitPriceChange(e.target.value)}
                placeholder="0"
                className="text-right pr-12 font-mono text-[14px] leading-5 font-medium tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[12px] font-medium text-text-tertiary">
                VND
              </span>
            </div>
          </FormField>
          <FormField label={t('inventory:productFormModal.fieldDescription')} htmlFor="product-description">
            <Textarea id="product-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>

          {isEditing && product ? (
            <div className="space-y-2 border-t border-border-subtle pt-3">
              <p className="text-[13px] font-medium text-text-secondary">{t('inventory:productFormModal.imageSectionTitle')}</p>
              <div className="flex items-start gap-3">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-radius-md border border-border-subtle bg-bg-subtle">
                  {displayedImageUrl ? (
                    <img src={displayedImageUrl} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <PackageIcon className="h-8 w-8 text-text-tertiary stroke-1.5" />
                  )}
                  {(setImage.isPending || removeImage.isPending) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Spinner size="sm" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleImageDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    className={cn(
                      'flex cursor-pointer items-center justify-center gap-1.5 rounded-radius-sm border border-dashed px-3 py-2 text-[12px] text-text-secondary transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-accent-soft',
                      isDragOver ? 'border-accent bg-accent-soft/60' : 'border-border-strong hover:border-accent hover:bg-bg-subtle',
                    )}
                  >
                    <UploadIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>{product.imageUrl ? t('inventory:productFormModal.replaceImage') : t('inventory:productFormModal.uploadImage')}</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const selected = e.target.files?.[0];
                        if (selected) selectImageFile(selected);
                        e.target.value = '';
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-text-tertiary">
                    {t('inventory:productFormModal.imageHint', { maxSize: formatBytes(MAX_PRODUCT_IMAGE_SIZE_BYTES) })}
                  </p>
                  {imageError && (
                    <p className="flex items-center gap-1 text-[11px] text-[#B3261E]">
                      <AlertCircleIcon className="h-3 w-3 shrink-0" /> {imageError}
                    </p>
                  )}
                  {product.imageUrl && !previewUrl && (
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveImage(true)}
                      className="text-[11px] font-medium text-[#B3261E] hover:underline cursor-pointer"
                    >
                      {t('inventory:productFormModal.removeImage')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-text-tertiary">{t('inventory:productFormModal.noImageYetHint')}</p>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmRemoveImage}
        onClose={() => setConfirmRemoveImage(false)}
        onConfirm={() => {
          if (product) removeImage.mutate(product.id);
          setConfirmRemoveImage(false);
        }}
        title={t('inventory:productFormModal.removeImageConfirmTitle')}
        description={t('inventory:productFormModal.removeImageConfirmDescription')}
        confirmLabel={t('inventory:productFormModal.removeImage')}
        danger
      />
    </>
  );
}
