// 16/10/2026: Inventory Service (Danh muc san pham + Kho, gan giao dich khach hang de phan tich xu
// huong thi truong) - cac hook TanStack Query, mirror 1:1 phong cach cua features/crm/hooks.ts
// (query key la mang [resource, params], mutation luon toast.success/toast.error qua
// extractErrorMessage(error) + invalidateQueries() cac query lien quan sau khi thanh cong).
//
// Ghi chu ve "gan mat hang cho khach hang" (useCustomerPurchasesQuery va cac hook lien quan ben
// duoi): cac hook nay duoc dung boi man hinh chi tiet khach hang (CustomerDetailPage.tsx), KHONG
// phai boi ProductsPage.tsx/WarehousePage.tsx trong module nay - ca 3 file do thuoc pham vi mot
// nhanh cong viec khac dang trien khai song song. Ten ham o day la hop dong chung giua 2 ben nen
// GIU NGUYEN, khong doi.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import {
  createCustomerPurchase,
  createProduct,
  createProductCategory,
  createStockMovement,
  createWarehouse,
  deleteCustomerPurchase,
  deleteProduct,
  deleteProductCategory,
  deleteWarehouse,
  fetchCustomerPurchase,
  fetchCustomerPurchases,
  fetchProduct,
  fetchProductCategories,
  fetchProducts,
  fetchStock,
  fetchStockMovements,
  fetchWarehouses,
  removeProductImage,
  setProductImage,
  updateCustomerPurchase,
  updateProduct,
  updateProductCategory,
  updateWarehouse,
} from './api';
import type {
  CreateCustomerPurchasePayload,
  CreateProductCategoryPayload,
  CreateProductPayload,
  CreateStockMovementPayload,
  CreateWarehousePayload,
  FetchCustomerPurchasesParams,
  FetchProductCategoriesParams,
  FetchProductsParams,
  FetchStockMovementsParams,
  FetchStockParams,
  FetchWarehousesParams,
  UpdateCustomerPurchasePayload,
  UpdateProductCategoryPayload,
  UpdateProductPayload,
  UpdateWarehousePayload,
} from './api';

// ---------------------------------------------------------------------------
// Danh muc san pham (Product Categories)
// ---------------------------------------------------------------------------

export function useProductCategoriesQuery(params: FetchProductCategoriesParams = {}) {
  return useQuery({ queryKey: ['product-categories', params], queryFn: () => fetchProductCategories(params) });
}

export function useCreateProductCategory() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProductCategoryPayload) => createProductCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success(t('inventory:hooks.productCategory.createSuccess'));
    },
    onError: (error) => toast.error(t('inventory:hooks.productCategory.createError'), extractErrorMessage(error)),
  });
}

export function useUpdateProductCategory(id: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProductCategoryPayload) => updateProductCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success(t('inventory:hooks.productCategory.updateSuccess'));
    },
    onError: (error) => toast.error(t('inventory:hooks.productCategory.updateError'), extractErrorMessage(error)),
  });
}

export function useDeleteProductCategory() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProductCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success(t('inventory:hooks.productCategory.deleteSuccess'));
    },
    // 16/10/2026: loi 409 PRODUCT_CATEGORY_HAS_PRODUCTS (danh muc con san pham) duoc extractErrorMessage()
    // tu dong dich qua errors:PRODUCT_CATEGORY_HAS_PRODUCTS (en/ja) hoac fallback dung message tieng
    // Viet backend tra ve (vi) - khong can xu ly rieng o day.
    onError: (error) => toast.error(t('inventory:hooks.productCategory.deleteError'), extractErrorMessage(error)),
  });
}

// ---------------------------------------------------------------------------
// San pham (Products)
// ---------------------------------------------------------------------------

export function useProductsQuery(params: FetchProductsParams = {}) {
  return useQuery({ queryKey: ['products', params], queryFn: () => fetchProducts(params) });
}

export function useProductQuery(id: string | undefined) {
  return useQuery({ queryKey: ['product', id], queryFn: () => fetchProduct(id as string), enabled: Boolean(id) });
}

export function useCreateProduct() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProductPayload) => createProduct(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // San pham moi lam thay doi productCount cua danh muc chua no.
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success(t('inventory:hooks.product.createSuccess'));
    },
    onError: (error) => toast.error(t('inventory:hooks.product.createError'), extractErrorMessage(error)),
  });
}

export function useUpdateProduct(id: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProductPayload) => updateProduct(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      // Doi categoryId lam thay doi productCount cua CA danh muc cu va danh muc moi.
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success(t('inventory:hooks.product.updateSuccess'));
    },
    onError: (error) => toast.error(t('inventory:hooks.product.updateError'), extractErrorMessage(error)),
  });
}

export function useDeleteProduct() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success(t('inventory:hooks.product.deleteSuccess'));
    },
    // 16/10/2026: loi 409 PRODUCT_HAS_PURCHASE_HISTORY (san pham da co lich su mua hang) cung di qua
    // extractErrorMessage() nhu tren.
    onError: (error) => toast.error(t('inventory:hooks.product.deleteError'), extractErrorMessage(error)),
  });
}

export function useSetProductImage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file, onProgress }: { id: string; file: File; onProgress?: (pct: number) => void }) =>
      setProductImage(id, file, onProgress),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] });
      toast.success(t('inventory:hooks.product.imageUpdateSuccess'));
    },
    onError: (error) => toast.error(t('inventory:hooks.product.imageUpdateError'), extractErrorMessage(error)),
  });
}

export function useRemoveProductImage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeProductImage(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      toast.success(t('inventory:hooks.product.imageRemoveSuccess'));
    },
    onError: (error) => toast.error(t('inventory:hooks.product.imageRemoveError'), extractErrorMessage(error)),
  });
}

// ---------------------------------------------------------------------------
// Kho (Warehouses)
// ---------------------------------------------------------------------------

export function useWarehousesQuery(params: FetchWarehousesParams = {}) {
  return useQuery({ queryKey: ['warehouses', params], queryFn: () => fetchWarehouses(params) });
}

export function useCreateWarehouse() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWarehousePayload) => createWarehouse(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success(t('inventory:hooks.warehouse.createSuccess'));
    },
    onError: (error) => toast.error(t('inventory:hooks.warehouse.createError'), extractErrorMessage(error)),
  });
}

export function useUpdateWarehouse(id: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateWarehousePayload) => updateWarehouse(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success(t('inventory:hooks.warehouse.updateSuccess'));
    },
    onError: (error) => toast.error(t('inventory:hooks.warehouse.updateError'), extractErrorMessage(error)),
  });
}

export function useDeleteWarehouse() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success(t('inventory:hooks.warehouse.deleteSuccess'));
    },
    // 16/10/2026: loi 409 WAREHOUSE_HAS_STOCK (kho con ton hang) cung di qua extractErrorMessage().
    onError: (error) => toast.error(t('inventory:hooks.warehouse.deleteError'), extractErrorMessage(error)),
  });
}

// ---------------------------------------------------------------------------
// Ton kho & Bien dong kho (Stock & Stock Movements)
// ---------------------------------------------------------------------------

export function useStockQuery(params: FetchStockParams = {}) {
  return useQuery({ queryKey: ['stock', params], queryFn: () => fetchStock(params) });
}

export function useStockMovementsQuery(params: FetchStockMovementsParams = {}) {
  return useQuery({ queryKey: ['stock-movements', params], queryFn: () => fetchStockMovements(params) });
}

export function useCreateStockMovement() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStockMovementPayload) => createStockMovement(payload),
    onSuccess: () => {
      // Ghi nhan bien dong lam thay doi CA ton kho hien tai (['stock']) VA lich su bien dong
      // (['stock-movements']) VA tong ton kho hien tren danh sach kho (['warehouses']).
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success(t('inventory:hooks.stockMovement.createSuccess'));
    },
    // 16/10/2026: loi 409 STOCK_INSUFFICIENT (khong du ton kho) cung di qua extractErrorMessage().
    onError: (error) => toast.error(t('inventory:hooks.stockMovement.createError'), extractErrorMessage(error)),
  });
}

// ---------------------------------------------------------------------------
// Gan mat hang cho khach hang (Customer Purchases)
// ---------------------------------------------------------------------------

export function useCustomerPurchasesQuery(params: FetchCustomerPurchasesParams = {}) {
  return useQuery({ queryKey: ['customer-purchases', params], queryFn: () => fetchCustomerPurchases(params) });
}

export function useCustomerPurchaseQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['customer-purchase', id],
    queryFn: () => fetchCustomerPurchase(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateCustomerPurchase() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCustomerPurchasePayload) => createCustomerPurchase(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-purchases'] });
      // 16/10/2026: neu kem warehouseId, BE tru kho NGAY LUC tao (atomic) - lam thay doi ca ton
      // kho va tong ton kho hien tren danh sach kho, nen invalidate rong ca 2 khoa nay du khong
      // the biet chac payload co kem warehouseId hay khong (vo hai neu khong co gi thay doi).
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success(t('inventory:hooks.customerPurchase.createSuccess'));
    },
    // 16/10/2026: loi 409 STOCK_INSUFFICIENT (khong du ton kho, khi co kem warehouseId) cung di qua
    // extractErrorMessage().
    onError: (error) => toast.error(t('inventory:hooks.customerPurchase.createError'), extractErrorMessage(error)),
  });
}

export function useUpdateCustomerPurchase(id: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    // 16/10/2026: PATCH chi nhan purchasedAt/note (xem UpdateCustomerPurchasePayload tai api.ts) -
    // quantity/product/price/warehouse la bat bien, khong anh huong ton kho nen KHONG can invalidate
    // ['stock']/['warehouses'] o day (khac useCreateCustomerPurchase/useDeleteCustomerPurchase).
    mutationFn: (payload: UpdateCustomerPurchasePayload) => updateCustomerPurchase(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['customer-purchase', id] });
      toast.success(t('inventory:hooks.customerPurchase.updateSuccess'));
    },
    onError: (error) => toast.error(t('inventory:hooks.customerPurchase.updateError'), extractErrorMessage(error)),
  });
}

export function useDeleteCustomerPurchase() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomerPurchase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-purchases'] });
      // 16/10/2026: xoa 1 giao dich co kem warehouseId se tu dong HOAN LAI ton kho (BE) - invalidate
      // rong nhu useCreateCustomerPurchase() o tren, cung ly do (khong biet chac ban ghi bi xoa co
      // kem warehouseId hay khong tai thoi diem nay).
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success(t('inventory:hooks.customerPurchase.deleteSuccess'));
    },
    onError: (error) => toast.error(t('inventory:hooks.customerPurchase.deleteError'), extractErrorMessage(error)),
  });
}
