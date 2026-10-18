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
import { formatVnd } from '../utils';
import { ProductFormModal } from './ProductFormModal';
import type { Product } from '@/types';

export function ProductCard({ product, categoryName }: { product: Product; categoryName: string }) {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const canManage = permissions.includes(PERMISSIONS.PRODUCT_MANAGE);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const del = useDeleteProduct();

  return (
    <>
      <div className="group relative flex flex-col overflow-hidden rounded-radius-lg border border-border-subtle bg-white transition-colors hover:border-border-strong">
        <div className="relative flex aspect-square w-full items-center justify-center bg-bg-subtle">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <PackageIcon className="h-10 w-10 text-text-tertiary stroke-1.5" />
          )}
          {canManage && (
            <div className="absolute right-2 top-2">
              <Dropdown
                align="right"
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="flex h-7 w-7 items-center justify-center rounded-radius-sm bg-white/90 text-text-tertiary shadow-sm hover:bg-white hover:text-text-primary transition-colors cursor-pointer"
                    aria-label={t('inventory:productCard.optionsAriaLabel')}
                  >
                    <MoreVerticalIcon className="h-4 w-4" />
                  </button>
                )}
              >
                {({ close }) => (
                  <div className="min-w-[160px] p-1 rounded-radius-md border border-border-subtle bg-white shadow-md">
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
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <p className="truncate text-[14px] leading-5 font-semibold text-text-primary" title={product.name}>
            {product.name}
          </p>
          <p className="truncate font-mono text-[12px] leading-4 text-text-tertiary">{product.sku}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate rounded-radius-xs bg-bg-subtle px-2 py-0.5 text-[11px] font-medium text-text-secondary">
              {categoryName}
            </span>
            <span className="shrink-0 font-mono text-[13px] font-medium tabular-nums text-accent">{formatVnd(product.unitPrice)}</span>
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
