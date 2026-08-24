// 22/08/2026: file moi - test cho numericTransformer (fix loi hop dong kieu Deal.value, review).
import { numericTransformer } from './numeric.transformer';

describe('numericTransformer (chuan hoa cot Postgres numeric ve number - fix 22/08/2026)', () => {
  it('from() chuyen string tra ve tu Postgres thanh number', () => {
    expect(numericTransformer.from('50000000.00')).toBe(50000000);
  });

  it('from() giu dung phan thap phan', () => {
    expect(numericTransformer.from('1234.56')).toBe(1234.56);
  });

  it('from() chuyen dung gia tri "0" (default cua Deal.value)', () => {
    expect(numericTransformer.from('0')).toBe(0);
  });

  it('to() giu nguyen number khi ghi xuong DB, khong bien doi', () => {
    expect(numericTransformer.to(50000000)).toBe(50000000);
    expect(numericTransformer.to(0)).toBe(0);
  });
});
