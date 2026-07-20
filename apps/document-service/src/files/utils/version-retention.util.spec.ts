import { MAX_FILE_VERSIONS, pruneOldVersions } from './version-retention.util';

function v(versionNumber: number) {
  return { versionNumber };
}

describe('pruneOldVersions (chinh sach versioning - Technical_Spec.md muc 3.4)', () => {
  it('MAX_FILE_VERSIONS mac dinh la 5', () => {
    expect(MAX_FILE_VERSIONS).toBe(5);
  });

  it('khong xoa gi khi tong so ban <= gioi han (dung 5 ban)', () => {
    const versions = [v(1), v(2), v(3), v(4), v(5)];
    expect(pruneOldVersions(versions)).toEqual([]);
  });

  it('khong xoa gi khi tong so ban it hon gioi han', () => {
    expect(pruneOldVersions([v(1), v(2)])).toEqual([]);
  });

  it('xoa dung 1 ban CU NHAT khi vua vuot qua gioi han (6 ban, gioi han 5)', () => {
    const versions = [v(1), v(2), v(3), v(4), v(5), v(6)];
    const result = pruneOldVersions(versions);
    expect(result).toEqual([v(1)]);
  });

  it('xoa nhieu ban cu nhat khi vuot qua gioi han nhieu hon 1 (8 ban, gioi han 5)', () => {
    const versions = [v(1), v(2), v(3), v(4), v(5), v(6), v(7), v(8)];
    const result = pruneOldVersions(versions);
    expect(result.map((r) => r.versionNumber)).toEqual([1, 2, 3]);
  });

  it('khong phu thuoc thu tu dau vao - tu sap xep theo versionNumber truoc khi tinh', () => {
    const versions = [v(6), v(2), v(4), v(1), v(5), v(3)];
    const result = pruneOldVersions(versions);
    expect(result.map((r) => r.versionNumber)).toEqual([1]);
  });

  it('ho tro gioi han tuy chinh qua tham so maxVersions', () => {
    const versions = [v(1), v(2), v(3)];
    const result = pruneOldVersions(versions, 2);
    expect(result.map((r) => r.versionNumber)).toEqual([1]);
  });

  it('khong lam thay doi mang dau vao (immutable)', () => {
    const versions = [v(3), v(1), v(2), v(4), v(5), v(6)];
    const original = [...versions];
    pruneOldVersions(versions);
    expect(versions).toEqual(original);
  });
});
