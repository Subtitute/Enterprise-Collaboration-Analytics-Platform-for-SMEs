// 16/10/2026: The nho cho 1 san pham tren luoi "Danh mục sản phẩm" (ProductsPage.tsx) - mirror
// cau truc CustomerCard.tsx (features/crm/components): anh/placeholder, ten + SKU, menu ⋯ (Sua/Xoa)
// CHI hien khi co PRODUCT_MANAGE, modal Sua + ConfirmDialog xoa duoc quan ly ngay tai day (giong
// EditCustomerModal/ConfirmDialog trong CustomerCard.tsx).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/stores/auth.store';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { EditIcon, MoreVerticalIcon, PackageIcon, TrashIcon } from '@/components/ui/Icons';
import { useDeleteProduct } from '../hooks';
import { ProductFormModal } from './ProductFormModal';
import type { Product } from '@/types';

export function ProductCard({ product, categoryName }: { product: Product; categoryName: string }) {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const canManage = permissions.includes(PERMISSIONS.PRODUCT_MANAGE);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imgError, setImgError] = useState(false);
  const del = useDeleteProduct();

  return (
    <>
      <div className="group relative flex flex-col overflow-hidden rounded-[8px] border border-border-subtle bg-white p-3 transition-colors duration-200 hover:border-border-strong">
        <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-[#F4F4F5] shrink-0">
          {product.imageUrl && !imgError ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <PackageIcon className="h-8 w-8 text-text-tertiary stroke-1.5" />
          )}
        </div>
        <div className="flex flex-col pt-3">
          <p
            className="line-clamp-2 min-h-[40px] text-[14px] leading-5 font-semibold text-[#1C1B1A] transition-colors duration-200 group-hover:text-[#0E5E5E]"
            title={product.name}
          >
            {product.name}
          </p>
          <p className="truncate font-mono text-[11px] leading-4 font-medium text-text-tertiary mt-1">{product.sku}</p>
          <div className="mt-3.5 flex items-center justify-between gap-2">
            <span className="truncate rounded-[2px] bg-[#E4EFEE] px-2 py-0.5 text-[11px] font-semibold text-[#0E5E5E]">
              {categoryName}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 font-mono text-[14px] font-semibold tabular-nums text-[#1C1B1A]">
                {typeof product.unitPrice === 'number' && !Number.isNaN(product.unitPrice)
                  ? new Intl.NumberFormat('vi-VN').format(product.unitPrice)
                  : '0'}
                <span className="ml-1 text-[11px] font-medium text-text-tertiary">VND</span>
              </span>
              {canManage && (
                <Dropdown
                  align="right"
                  trigger={({ toggle }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      className="flex h-6 w-6 items-center justify-center rounded-[2px] text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
                      aria-label={t('inventory:productCard.optionsAriaLabel')}
                    >
                      <MoreVerticalIcon className="h-4 w-4" />
                    </button>
                  )}
                >
                  {({ close }) => (
                    <div className="min-w-[160px] p-1 rounded-radius-md border border-[#E5E4E0] bg-white">
                      <DropdownItem
                        onClick={() => {
                          setIsEditOpen(true);
                          close();
                        }}
                      >
                        <EditIcon className="h-4 w-4 text-text-secondary" /> {t('inventory:productCard.editProduct')}
                      </DropdownItem>
                      <DropdownItem
                        className="text-[#B3261E] hover:bg-[#F8E5E3]"
                        onClick={() => {
                          setConfirmDelete(true);
                          close();
                        }}
                      >
                        <TrashIcon className="h-4 w-4 text-[#B3261E]" /> {t('inventory:productCard.deleteProduct')}
                      </DropdownItem>
                    </div>
                  )}
                </Dropdown>
              )}
            </div>
          </div>
        </div>
      </div>

      {canManage && <ProductFormModal product={product} open={isEditOpen} onClose={() => setIsEditOpen(false)} />}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          del.mutate(product.id);
          setConfirmDelete(false);
        }}
        title={t('inventory:productCard.deleteConfirmTitle')}
        description={t('inventory:productCard.deleteConfirmDescription', { name: product.name })}
        confirmLabel={t('inventory:productCard.deleteProduct')}
        danger
      />
    </>
  );
}
