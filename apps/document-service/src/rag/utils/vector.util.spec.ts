// 24/10/2026: unit test phep toan vector cho RAG (vector.util.ts).
import { cosineSimilarity, l2Normalize, rankBySimilarity } from './vector.util';

describe('cosineSimilarity', () => {
  it('2 vector cung huong = 1, vuong goc = 0, nguoc huong = -1', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('lech so chieu, vector rong hoac vector 0 -> 0 (khong NaN)', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe('l2Normalize', () => {
  it('vector ket qua co do dai 1, giu nguyen huong', () => {
    const normalized = l2Normalize([3, 4]);
    expect(normalized[0]).toBeCloseTo(0.6);
    expect(normalized[1]).toBeCloseTo(0.8);
  });

  it('vector 0 giu nguyen la vector 0', () => {
    expect(l2Normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe('rankBySimilarity', () => {
  const items = [
    { id: 'a', embedding: [1, 0] },
    { id: 'b', embedding: [0.9, 0.1] },
    { id: 'c', embedding: [0, 1] },
    { id: 'd', embedding: [0.7, 0.7] },
  ];

  it('sap xep giam dan theo diem va cat theo k', () => {
    const ranked = rankBySimilarity([1, 0], items, 2, 0);
    expect(ranked.map((r) => r.item.id)).toEqual(['a', 'b']);
  });

  it('loai bo muc duoi nguong minScore', () => {
    const ranked = rankBySimilarity([1, 0], items, 10, 0.5);
    expect(ranked.map((r) => r.item.id)).toEqual(['a', 'b', 'd']);
  });
});
