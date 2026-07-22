import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { paginate, PaginationQueryDto } from './pagination.dto';

// 22/07/2026: bo sung file test nay - phat hien qua code review toan du an: @app/common-dto
// duoc ca 6 service dung chung (Technical_Spec.md muc 4.3, muc 7) nhung truoc do khong co bat
// ky test nao, nen mot thay doi hong o day (vd sai gioi han @Max/@Min) se am tham lan sang toan
// bo he thong ma khong co CI nao bat duoc. Bo cuc/cau hinh jest sao chep tu
// packages/common-guard/package.json de dong nhat giua 2 package dung chung.
describe('paginate', () => {
  it('tra ve meta dung khi tap ket qua rong (total = 0) - khong duoc nem loi/NaN', () => {
    const result = paginate<number>([], 0, 1, 20);

    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 0 });
  });

  it('tra ve dung khi total la boi so CHINH XAC cua limit (bien trang cuoi vua khop)', () => {
    const dataTrangCuoi = Array.from({ length: 10 }, (_, i) => i);
    // 30 ban ghi, limit 10 -> dung 3 trang, trang 3 (trang cuoi) phai co du 10 phan tu, khong thieu/thua.
    const result = paginate<number>(dataTrangCuoi, 30, 3, 10);

    expect(result.data).toHaveLength(10);
    expect(result.meta).toEqual({ page: 3, limit: 10, total: 30 });
  });

  it('tra ve dung khi chi co dung 1 ket qua', () => {
    const result = paginate<string>(['only-item'], 1, 1, 20);

    expect(result.data).toEqual(['only-item']);
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
  });
});

describe('PaginationQueryDto', () => {
  async function validateQuery(plain: Record<string, unknown>) {
    const instance = plainToInstance(PaginationQueryDto, plain);
    return validate(instance);
  }

  it('dung gia tri mac dinh (page=1, limit=20) khi khong truyen query nao', async () => {
    const instance = plainToInstance(PaginationQueryDto, {});

    expect(instance.page).toBe(1);
    expect(instance.limit).toBe(20);
    expect(await validate(instance)).toHaveLength(0);
  });

  it('chap nhan limit=500 (dung bien @Max(500) hien tai)', async () => {
    const errors = await validateQuery({ page: 1, limit: 500 });
    expect(errors).toHaveLength(0);
  });

  it('tu choi limit=501 (vuot tran @Max(500))', async () => {
    const errors = await validateQuery({ page: 1, limit: 501 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('tu choi page=0 (vi pham @Min(1))', async () => {
    const errors = await validateQuery({ page: 0, limit: 20 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  // 22/07/2026: test cho Fix 2 (xem pagination.dto.ts) - "page" truoc day khong co @Max, nhan
  // page=999999999 va bien thanh OFFSET khong lo trong moi cau query danh sach o ca 6 service.
  it('chap nhan page=100000 (dung bien @Max moi bo sung)', async () => {
    const errors = await validateQuery({ page: 100000, limit: 20 });
    expect(errors).toHaveLength(0);
  });

  it('tu choi page=100001 (vuot tran @Max(100000) moi bo sung - chan OFFSET khong lo)', async () => {
    const errors = await validateQuery({ page: 100001, limit: 20 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('tu choi page=999999999 (gia tri tan cong DoS thuc te tung phat hien trong code review)', async () => {
    const errors = await validateQuery({ page: 999999999, limit: 500 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });
});
