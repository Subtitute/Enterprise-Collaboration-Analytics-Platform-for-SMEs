import { ValueTransformer } from 'typeorm';

/**
 * `bigint` cua Postgres duoc driver `pg` tra ve dang string de tranh mat precision - dung
 * transformer nay tren cac cot `type: 'bigint'` de giu kieu `number` o tang ung dung (an
 * toan vi kich thuoc file <= 25MB, gioi han upload cua Document Service).
 *
 * Dat trong file rieng (khong dat trong 1 trong 2 entity FileMeta/FileVersion) de tranh
 * import vong (circular import) giua chung - ca hai deu tham chieu lan nhau qua quan he
 * FileMeta 1-N FileVersion.
 */
export const bigintTransformer: ValueTransformer = {
  to: (value: number) => value,
  from: (value: string) => parseInt(value, 10),
};
