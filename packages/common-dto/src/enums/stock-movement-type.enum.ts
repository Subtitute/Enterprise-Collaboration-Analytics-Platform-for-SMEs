/**
 * Loai bien dong kho (Inventory Service - Danh muc san pham + Kho, Technical_Spec.md muc 22).
 *
 * `quantityDelta` tren StockMovement la gia tri CO DAU (am/duong), KHONG phai gia tri tuyet doi -
 * `type` chi la nhan mo ta/loc hien thi, logic ap dung ton kho CHI dua vao dau cua quantityDelta
 * (newQuantity = currentQuantity + quantityDelta). Rang buoc dau theo tung loai (kiem tra o
 * CreateStockMovementDto/StockService):
 *  - IN: quantityDelta PHAI duong (nhap kho - hang ve).
 *  - OUT: quantityDelta PHAI am (xuat kho - ban hang/tieu hao).
 *  - ADJUSTMENT: cho phep CA 2 dau (dieu chinh kiem ke - vd phat hien thieu/du hang thuc te so voi
 *    he thong), khong gioi han nhu IN/OUT.
 */
export enum StockMovementType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT',
}
