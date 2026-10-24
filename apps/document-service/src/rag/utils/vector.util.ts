/**
 * 24/10/2026: phep toan vector cho RAG (cosine brute-force, KHONG dung pgvector - xem
 * entities/document-chunk.entity.ts). Ham thuan (pure), unit test doc lap (vector.util.spec.ts).
 */

/** Chuan hoa L2 - gemini-embedding-001 chi tu chuan hoa o 3072 chieu, ban rut gon 768 chieu thi KHONG. */
export function l2Normalize(vector: number[]): number[] {
  let sumSquares = 0;
  for (const value of vector) sumSquares += value * value;
  const norm = Math.sqrt(sumSquares);
  if (norm === 0) return vector.map(() => 0);
  return vector.map((value) => value / norm);
}

/** Cosine similarity day du (khong gia dinh vector da chuan hoa) - 0 khi lech so chieu hoac vector rong. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Xep hang theo cosine giam dan, giu toi da `k` muc co diem >= `minScore`. */
export function rankBySimilarity<T extends { embedding: number[] }>(
  query: number[],
  items: T[],
  k: number,
  minScore: number,
): { item: T; score: number }[] {
  return items
    .map((item) => ({ item, score: cosineSimilarity(query, item.embedding) }))
    .filter((entry) => entry.score >= minScore)
    .sort((x, y) => y.score - x.score)
    .slice(0, k);
}
