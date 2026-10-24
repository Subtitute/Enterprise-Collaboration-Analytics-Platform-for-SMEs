/**
 * 24/10/2026: chia van ban tai lieu thanh cac doan (chunk) de nhung (embedding) cho RAG - Technical_Spec.md
 * muc 23. Chia THEO DO DAI ky tu (~800 ky tu, chong lan ~100 ky tu giua 2 doan lien tiep), KHONG lam
 * chunking ngu nghia phuc tap (dung dinh huong toi gian o quy mo do an). Uu tien cat tai ranh gioi tu
 * nhien (doan van > xuong dong > het cau > khoang trang) trong 40% cuoi cua cua so de khong cat ngang
 * 1 tu/cau. Ham thuan (pure) - unit test doc lap (chunking.util.spec.ts).
 */
export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 100;

const BOUNDARY_SEPARATORS = ['\n\n', '\n', '. ', '? ', '! ', '; ', ' '];

/**
 * Chuan hoa van ban truoc khi chia: bo BOM + ky tu dieu khien (vd NUL - Postgres `text` tu choi byte
 * 0x00, hay gap trong van ban trich tu PDF), thong nhat xuong dong, gop khoang trang/dong trong thua.
 */
export function normalizeText(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/(?![\n\t])\p{Cc}/gu, '')
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Vi tri ngat tot nhat (ngay SAU dau phan cach) nam trong [from, to] - -1 neu khong tim thay. */
// 24/10/2026 (fix kiem thu RAG): chi tim TRONG cua so [from, to] - truoc day `text.lastIndexOf(sep, to)`
// tren ca van ban: dau phan cach khong co trong cua so (vd '\n\n' o van ban khong co dong trong) lam
// moi lan goi quet nguoc ve TAN dau van ban -> O(n^2). Do song trong container: file .txt 9MB mat ~38s
// CPU dong bo (chan ca event loop - upload/health check dung theo) va ~155MB RAM.
function findBoundary(text: string, from: number, to: number): number {
  const window = text.slice(from, to);
  for (const separator of BOUNDARY_SEPARATORS) {
    const index = window.lastIndexOf(separator);
    if (index !== -1) return from + index + separator.length;
  }
  return -1;
}

export function chunkText(raw: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
  if (overlap >= chunkSize) throw new Error('overlap phai nho hon chunkSize');
  const text = normalizeText(raw);
  if (!text) return [];
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      const boundary = findBoundary(text, start + Math.floor(chunkSize * 0.6), end);
      if (boundary > start) end = boundary;
    }
    const piece = text.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= text.length) break;

    // Lui lai `overlap` ky tu de doan sau mang theo ngu canh cuoi doan truoc - can ve dau 1 tu
    // (sau khoang trang gan nhat) de doan moi khong bat dau giua chung 1 tu. LUON tien it nhat 1
    // ky tu so voi `start` cu (chong vong lap vo han).
    const overlapStart = end - overlap;
    const space = text.indexOf(' ', overlapStart);
    const nextStart = space !== -1 && space < end ? space + 1 : overlapStart;
    start = Math.max(nextStart, start + 1);
  }
  return chunks;
}
