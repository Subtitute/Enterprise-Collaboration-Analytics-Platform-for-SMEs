// 16/10/2026: Modal quan ly danh muc san pham (xem/them/sua/xoa) - mo tu ProductsPage.tsx, CHI
// render khi nguoi dung co PRODUCT_MANAGE (xem ProductsPage.tsx), nen khong kiem tra quyen lai o
// day. Danh sach danh muc o day dung LAI cung query key (['product-categories', {page:1,limit:100}])
// voi ProductsPage.tsx (dropdown loc) nen khong ton them 1 request rieng khi mo modal.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { QueryState } from '@/components/ui/QueryState';
import { EmptyState } from '@/components/ui/EmptyState';
import { EditIcon, FolderIcon, PlusIcon, TrashIcon } from '@/components/ui/Icons';
import { useDeleteProductCategory, useProductCategoriesQuery } from '../hooks';
import { CategoryModal } from './CategoryModal';
import type { ProductCategory } from '@/types';

export function ManageCategoriesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const categoriesQuery = useProductCategoriesQuery({ page: 1, limit: 100 });
  const categories = categoriesQuery.data?.data ?? [];
  const deleteCategory = useDeleteProductCategory();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ProductCategory | null>(null);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={
          <div className="flex items-center justify-between gap-3 pr-2">
            <h2 className="text-[16px] leading-[24px] font-semibold text-[#1C1B1A]">
              {t('inventory:manageCategoriesModal.title')}
            </h2>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-radius-sm bg-[#1C1B1A] px-3 text-[12px] font-medium text-white hover:bg-black transition-colors cursor-pointer"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>{t('inventory:manageCategoriesModal.newCategory')}</span>
            </button>
          </div>
        }
        size="md"
        footer={
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 rounded-radius-sm border-[#E5E4E0] bg-white hover:bg-[#F4F4F5] text-[#1C1B1A] text-[13px] font-medium"
            >
              {t('common:actions.close')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <QueryState isLoading={categoriesQuery.isLoading} isError={categoriesQuery.isError} onRetry={() => categoriesQuery.refetch()}>
            {categories.length === 0 ? (
              <EmptyState icon={<FolderIcon className="h-8 w-8 text-text-tertiary" />} title={t('inventory:manageCategoriesModal.emptyTitle')} />
            ) : (
              <div className="max-h-[50vh] overflow-y-auto divide-y divide-[#E5E4E0] border-t border-b border-[#E5E4E0]">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] leading-5 font-semibold text-[#1C1B1A]">{c.name}</p>
                      {c.description && <p className="truncate text-[12px] leading-4 text-text-tertiary">{c.description}</p>}
                    </div>
                    <span className="shrink-0 rounded-[2px] bg-[#F4F4F5] px-2 py-0.5 font-mono text-[12px] font-medium tabular-nums text-[#1C1B1A]">
                      {t('inventory:manageCategoriesModal.productCount', { count: c.productCount ?? 0 })}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingCategory(c)}
                        aria-label={t('inventory:manageCategoriesModal.editCategory')}
                        className="flex h-7 w-7 items-center justify-center rounded-radius-sm text-text-tertiary hover:bg-[#E4EFEE] hover:text-[#0E5E5E] transition-colors cursor-pointer"
                      >
                        <EditIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingCategory(c)}
                        aria-label={t('inventory:manageCategoriesModal.deleteCategory')}
                        className="flex h-7 w-7 items-center justify-center rounded-radius-sm text-[#B3261E] hover:bg-[#F8E5E3] transition-colors cursor-pointer"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </QueryState>
        </div>
      </Modal>

      <CategoryModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <CategoryModal open={Boolean(editingCategory)} onClose={() => setEditingCategory(null)} category={editingCategory} />

      <ConfirmDialog
        open={Boolean(deletingCategory)}
        onClose={() => setDeletingCategory(null)}
        onConfirm={() => {
          if (deletingCategory) deleteCategory.mutate(deletingCategory.id);
          setDeletingCategory(null);
        }}
        title={t('inventory:manageCategoriesModal.deleteConfirmTitle')}
        description={deletingCategory ? t('inventory:manageCategoriesModal.deleteConfirmDescription', { name: deletingCategory.name }) : undefined}
        confirmLabel={t('inventory:manageCategoriesModal.deleteCategory')}
        danger
      />
    </>
  );
}
