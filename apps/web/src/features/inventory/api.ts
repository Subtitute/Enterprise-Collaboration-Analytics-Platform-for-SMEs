// 16/10/2026: Inventory Service (Danh muc san pham + Kho, gan giao dich khach hang de phan tich xu
// huong thi truong) - lop goi API tho cho toan bo tinh nang, mirror 1:1 phong cach cua
// features/crm/api.ts (fetchXxx/createXxx/updateXxx/deleteXxx + interface Fetch*Params/Create*Payload
// rieng). Khong tu map/doi ten truong - backend tra ve dung camelCase khop voi cac interface trong
// @/types (ProductCategory, Product, Warehouse, WarehouseStock, StockMovement, CustomerPurchase).
import { apiClient } from '@/lib/api-client';
import { t } from '@/i18n';
import { formatBytes } from '@/lib/utils';
import type {
  CustomerPurchase,
  PaginatedResponse,
  Product,
  ProductCategory,
  StockMovement,
  StockMovementType,
  Warehouse,
  WarehouseStock,
} from '@/types';

// ---------------------------------------------------------------------------
// Danh muc san pham (Product Categories)
// ---------------------------------------------------------------------------

export interface FetchProductCategoriesParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function fetchProductCategories(params: FetchProductCategoriesParams = {}): Promise<PaginatedResponse<ProductCategory>> {
  const { data } = await apiClient.get<PaginatedResponse<ProductCategory>>('/product-categories', { params });
  return data;
}

export async function fetchProductCategory(id: string): Promise<ProductCategory> {
  const { data } = await apiClient.get<ProductCategory>(`/product-categories/${id}`);
  return data;
}

export interface CreateProductCategoryPayload {
  name: string;
  description?: string;
}

export async function createProductCategory(payload: CreateProductCategoryPayload): Promise<ProductCategory> {
  const { data } = await apiClient.post<ProductCategory>('/product-categories', payload);
  return data;
}

export type UpdateProductCategoryPayload = Partial<CreateProductCategoryPayload>;

export async function updateProductCategory(id: string, payload: UpdateProductCategoryPayload): Promise<ProductCategory> {
  const { data } = await apiClient.patch<ProductCategory>(`/product-categories/${id}`, payload);
  return data;
}

export async function deleteProductCategory(id: string): Promise<void> {
  await apiClient.delete(`/product-categories/${id}`);
}

// ---------------------------------------------------------------------------
// San pham (Products)
// ---------------------------------------------------------------------------

export interface FetchProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
}

export async function fetchProducts(params: FetchProductsParams = {}): Promise<PaginatedResponse<Product>> {
  const { data } = await apiClient.get<PaginatedResponse<Product>>('/products', { params });
  return data;
}

export async function fetchProduct(id: string): Promise<Product> {
  const { data } = await apiClient.get<Product>(`/products/${id}`);
  return data;
}

export interface CreateProductPayload {
  categoryId: string;
  name: string;
  sku: string;
  description?: string;
  unitPrice?: number;
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const { data } = await apiClient.post<Product>('/products', payload);
  return data;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
  const { data } = await apiClient.patch<Product>(`/products/${id}`, payload);
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  await apiClient.delete(`/products/${id}`);
}

// 16/10/2026: allowlist/kich thuoc anh san pham PHAI khop CHINH XAC voi backend (Inventory Service
// - POST /products/:id/image chi nhan image/jpeg|png|webp, toi da 5MB) - mirror
// ALLOWED_UPLOAD_MIME_TYPES/MAX_UPLOAD_SIZE_BYTES cua features/documents/api.ts, gia tri rieng cho
// anh san pham (nho hon va it loai hon upload tai lieu).
export const ALLOWED_PRODUCT_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** Validate anh san pham truoc khi upload (client-side, phan hoi tuc thi) - server van la noi
 *  thuc thi that su. Tra ve null neu hop le, nguoc lai tra ve thong diep loi. */
export function validateProductImageFile(file: File): string | null {
  if (!(ALLOWED_PRODUCT_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return t('inventory:api.unsupportedImageType');
  }
  if (file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
    return t('inventory:api.imageTooLarge', { maxSize: formatBytes(MAX_PRODUCT_IMAGE_SIZE_BYTES) });
  }
  return null;
}

export async function setProductImage(id: string, file: File, onProgress?: (pct: number) => void): Promise<Product> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<Product>(`/products/${id}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
  return data;
}

export async function removeProductImage(id: string): Promise<Product> {
  const { data } = await apiClient.delete<Product>(`/products/${id}/image`);
  return data;
}

// ---------------------------------------------------------------------------
// Kho (Warehouses)
// ---------------------------------------------------------------------------

export interface FetchWarehousesParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function fetchWarehouses(params: FetchWarehousesParams = {}): Promise<PaginatedResponse<Warehouse>> {
  const { data } = await apiClient.get<PaginatedResponse<Warehouse>>('/warehouses', { params });
  return data;
}

export async function fetchWarehouse(id: string): Promise<Warehouse> {
  const { data } = await apiClient.get<Warehouse>(`/warehouses/${id}`);
  return data;
}

export interface CreateWarehousePayload {
  name: string;
  address?: string;
}

export async function createWarehouse(payload: CreateWarehousePayload): Promise<Warehouse> {
  const { data } = await apiClient.post<Warehouse>('/warehouses', payload);
  return data;
}

export type UpdateWarehousePayload = Partial<CreateWarehousePayload>;

export async function updateWarehouse(id: string, payload: UpdateWarehousePayload): Promise<Warehouse> {
  const { data } = await apiClient.patch<Warehouse>(`/warehouses/${id}`, payload);
  return data;
}

export async function deleteWarehouse(id: string): Promise<void> {
  await apiClient.delete(`/warehouses/${id}`);
}

// ---------------------------------------------------------------------------
// Ton kho & Bien dong kho (Stock & Stock Movements)
// ---------------------------------------------------------------------------

export interface FetchStockParams {
  page?: number;
  limit?: number;
  warehouseId?: string;
  productId?: string;
}

export async function fetchStock(params: FetchStockParams = {}): Promise<PaginatedResponse<WarehouseStock>> {
  const { data } = await apiClient.get<PaginatedResponse<WarehouseStock>>('/stock', { params });
  return data;
}

export interface FetchStockMovementsParams {
  page?: number;
  limit?: number;
  warehouseId?: string;
  productId?: string;
}

export async function fetchStockMovements(params: FetchStockMovementsParams = {}): Promise<PaginatedResponse<StockMovement>> {
  const { data } = await apiClient.get<PaginatedResponse<StockMovement>>('/stock-movements', { params });
  return data;
}

export interface CreateStockMovementPayload {
  warehouseId: string;
  productId: string;
  type: StockMovementType;
  /** Co dau (am/duong) - IN phai duong, OUT phai am, ADJUSTMENT ca 2 dau - xem ghi chu tai
   *  RecordStockMovementModal.tsx ve cach UI tinh dau truoc khi goi ham nay. */
  quantityDelta: number;
  note?: string;
}

export async function createStockMovement(payload: CreateStockMovementPayload): Promise<StockMovement> {
  const { data } = await apiClient.post<StockMovement>('/stock-movements', payload);
  return data;
}

// ---------------------------------------------------------------------------
// Gan mat hang cho khach hang (Customer Purchases) - nguon du lieu cho phan tich xu huong thi
// truong (analytics-service). UI tieu thu cac ham nay (vd CustomerDetailPage.tsx) nam ngoai pham
// vi module nay - xem ghi chu dau hooks.ts.
// ---------------------------------------------------------------------------

export interface FetchCustomerPurchasesParams {
  page?: number;
  limit?: number;
  customerId?: string;
  productId?: string;
}

export async function fetchCustomerPurchases(params: FetchCustomerPurchasesParams = {}): Promise<PaginatedResponse<CustomerPurchase>> {
  const { data } = await apiClient.get<PaginatedResponse<CustomerPurchase>>('/customer-purchases', { params });
  return data;
}

export async function fetchCustomerPurchase(id: string): Promise<CustomerPurchase> {
  const { data } = await apiClient.get<CustomerPurchase>(`/customer-purchases/${id}`);
  return data;
}

export interface CreateCustomerPurchasePayload {
  customerId: string;
  productId: string;
  warehouseId?: string;
  quantity: number;
  unitPrice?: number;
  /** Dinh dang 'YYYY-MM-DD' (DatePicker.tsx tra ve dung dinh dang nay). */
  purchasedAt: string;
  note?: string;
}

export async function createCustomerPurchase(payload: CreateCustomerPurchasePayload): Promise<CustomerPurchase> {
  const { data } = await apiClient.post<CustomerPurchase>('/customer-purchases', payload);
  return data;
}

// 16/10/2026: PATCH /customer-purchases/:id CHI nhan purchasedAt/note - quantity/product/price/
// warehouse la bat bien sau khi tao (muon doi phai xoa roi tao lai, han che co chu dich tu backend).
export interface UpdateCustomerPurchasePayload {
  purchasedAt?: string;
  note?: string;
}

export async function updateCustomerPurchase(id: string, payload: UpdateCustomerPurchasePayload): Promise<CustomerPurchase> {
  const { data } = await apiClient.patch<CustomerPurchase>(`/customer-purchases/${id}`, payload);
  return data;
}

export async function deleteCustomerPurchase(id: string): Promise<void> {
  await apiClient.delete(`/customer-purchases/${id}`);
}
