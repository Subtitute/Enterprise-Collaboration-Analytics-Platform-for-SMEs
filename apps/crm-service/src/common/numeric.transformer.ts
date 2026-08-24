import { ValueTransformer } from 'typeorm';

/**
 * `numeric` cua Postgres duoc driver `pg` tra ve dang string de tranh mat precision - dung
 * transformer nay tren cac cot `type: 'numeric'` de giu kieu `number` o tang ung dung, mirror
 * bigint.transformer.ts (Document Service), cung 1 ly do.
 *
 * 22/08/2026: bo sung cho Deal.value - thieu transformer khien GET /deals tra ve value dang
 * string ("50000000.00"), sai hop dong kieu voi DTO/FE (apps/web/src/types/index.ts Deal.value:
 * number). Deal.value khong nullable (co default 0) nen `from` khong can xu ly null.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseFloat(value),
};
