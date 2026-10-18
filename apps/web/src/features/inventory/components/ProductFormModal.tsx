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
import { AlertCircleIcon, ImagePlusIcon, XIcon } from '@/components/ui/Icons';
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
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="h-9 rounded-radius-sm border-[#E5E4E0] bg-white hover:bg-[#F4F4F5] text-[#1C1B1A] text-[13px] font-medium"
            >
              {t('inventory:productFormModal.cancel')}
            </Button>
            <Button
              type="submit"
              form="product-form"
              isLoading={isPending}
              className="h-9 rounded-radius-sm bg-[#1C1B1A] hover:bg-black text-white text-[13px] font-medium"
            >
              {isEditing ? t('inventory:productFormModal.save') : t('inventory:productFormModal.create')}
            </Button>
          </div>
        }
      >
        <form
          id="product-form"
          onSubmit={handleSubmit}
          className="space-y-4"
          noValidate
        >
          {/* Dropzone Ảnh (OPTIONAL - KHÔNG dấu *) */}
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-text-primary">
              {t('inventory:productFormModal.imageSectionTitle')}
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleImageDrop}
              onClick={() => {
                if (!displayedImageUrl) fileInputRef.current?.click();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !displayedImageUrl) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={cn(
                'relative flex h-[120px] w-full flex-col items-center justify-center rounded-[8px] border border-dashed transition-colors',
                displayedImageUrl
                  ? 'border-[#E5E4E0] bg-[#F4F4F5]/30'
                  : 'cursor-pointer border-[#E5E4E0] bg-[#F4F4F5]/50 hover:border-[#0E5E5E] hover:bg-[#F4F4F5]',
                isDragOver && 'border-[#0E5E5E] bg-[#E4EFEE]/50',
              )}
            >
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

              {displayedImageUrl ? (
                <div className="relative flex h-full w-full items-center justify-center p-2">
                  <img
                    src={displayedImageUrl}
                    alt={name || 'Product preview'}
                    className="h-full max-h-[104px] w-auto max-w-full rounded-[4px] object-contain"
                  />
                  {(setImage.isPending || removeImage.isPending) && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-[8px] bg-white/70">
                      <Spinner size="sm" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (product?.imageUrl && !previewUrl) {
                        setConfirmRemoveImage(true);
                      } else {
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                        setImageError('');
                      }
                    }}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-[4px] bg-white/90 text-[#B3261E] hover:bg-[#F8E5E3] transition-colors cursor-pointer"
                    aria-label={t('inventory:productFormModal.removeImage')}
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5 text-center">
                  <ImagePlusIcon className="h-6 w-6 text-text-tertiary stroke-1.5" />
                  <p className="text-[12px] font-medium text-text-secondary">
                    {t('inventory:productFormModal.dropzoneUploadHint')}
                  </p>
                  <p className="text-[11px] text-text-tertiary">
                    {t('inventory:productFormModal.imageHint', { maxSize: formatBytes(MAX_PRODUCT_IMAGE_SIZE_BYTES) })}
                  </p>
                </div>
              )}
            </div>

            {imageError && (
              <p className="flex items-center gap-1 text-[11px] text-[#B3261E]">
                <AlertCircleIcon className="h-3 w-3 shrink-0" /> {imageError}
              </p>
            )}
            {!isEditing && (
              <p className="text-[11px] text-text-tertiary">{t('inventory:productFormModal.noImageYetHint')}</p>
            )}
          </div>

          {/* Row 2 cột: Danh mục * | Mã SKU * */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={t('inventory:productFormModal.fieldCategory')} htmlFor="product-category" error={categoryError} required>
              <CustomFilterSelect
                value={categoryId}
                onChange={setCategoryId}
                position="bottom"
                ariaLabel={t('inventory:productFormModal.fieldCategory')}
                options={[
                  { value: '', label: t('inventory:productFormModal.categoryPlaceholder') },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
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
          </div>

          {/* Tên sản phẩm * */}
          <FormField label={t('inventory:productFormModal.fieldName')} htmlFor="product-name" error={nameError} required>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('inventory:productFormModal.namePlaceholder')}
            />
          </FormField>

          {/* Đơn giá * */}
          <FormField label={t('inventory:productFormModal.fieldUnitPrice')} htmlFor="product-unit-price" required>
            <div className="relative">
              <Input
                id="product-unit-price"
                type="text"
                inputMode="numeric"
                value={unitPrice}
                onChange={(e) => handleUnitPriceChange(e.target.value)}
                placeholder="0"
                className="text-right pr-12 font-mono text-[14px] leading-5 font-semibold tabular-nums text-[#1C1B1A]"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] font-medium text-text-tertiary">
                VND
              </span>
            </div>
          </FormField>

          {/* Mô tả */}
          <FormField label={t('inventory:productFormModal.fieldDescription')} htmlFor="product-description">
            <Textarea
              id="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </FormField>
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
