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
      <Modal open={open} onClose={onClose} title={t('inventory:manageCategoriesModal.title')} size="md">
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={() => setIsCreateOpen(true)} className="rounded-radius-sm">
              <PlusIcon className="h-3.5 w-3.5" /> {t('inventory:manageCategoriesModal.newCategory')}
            </Button>
          </div>

          <QueryState isLoading={categoriesQuery.isLoading} isError={categoriesQuery.isError} onRetry={() => categoriesQuery.refetch()}>
            {categories.length === 0 ? (
              <EmptyState icon={<FolderIcon className="h-8 w-8 text-text-tertiary" />} title={t('inventory:manageCategoriesModal.emptyTitle')} />
            ) : (
              <div className="max-h-[50vh] divide-y divide-border-subtle overflow-y-auto rounded-radius-md border border-border-subtle popover-scrollbar">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-text-primary">{c.name}</p>
                      {c.description && <p className="truncate text-[12px] text-text-tertiary">{c.description}</p>}
                    </div>
                    <span className="shrink-0 rounded-radius-xs bg-bg-subtle px-2 py-0.5 text-[11px] font-mono tabular-nums text-text-secondary">
                      {t('inventory:manageCategoriesModal.productCount', { count: c.productCount ?? 0 })}
                    </span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setEditingCategory(c)}
                        aria-label={t('inventory:manageCategoriesModal.editCategory')}
                        className="flex h-7 w-7 items-center justify-center rounded-radius-sm text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
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
