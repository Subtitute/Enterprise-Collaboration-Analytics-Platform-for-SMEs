import { ValueTransformer } from 'typeorm';

/**
 * `numeric` cua Postgres duoc driver `pg` tra ve dang string de tranh mat precision - dung
 * transformer nay tren cac cot `type: 'numeric'` de giu kieu `number` o tang ung dung, mirror
 * apps/crm-service/src/common/numeric.transformer.ts (Deal.value) - cung 1 ly do, dung cho
 * Product.unitPrice/CustomerPurchase.unitPriceAtPurchase.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseFloat(value),
};
