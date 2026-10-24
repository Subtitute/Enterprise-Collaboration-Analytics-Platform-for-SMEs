// 24/10/2026: unit test chia doan van ban cho RAG (chunking.util.ts).
import { CHUNK_OVERLAP, CHUNK_SIZE, chunkText, normalizeText } from './chunking.util';

describe('normalizeText', () => {
  it('bo BOM, ky tu dieu khien (NUL), gop khoang trang va dong trong thua', () => {
    const raw = '\uFEFFDong 1\r\n\r\n\r\n\r\nDong\u0000  2\t\tcuoi   ';
    expect(normalizeText(raw)).toBe('Dong 1\n\nDong 2 cuoi');
  });

  it('giu nguyen chu tieng Viet co dau', () => {
    expect(normalizeText('Quy định nghỉ phép năm')).toBe('Quy định nghỉ phép năm');
  });
});

describe('chunkText', () => {
  it('van ban rong/chi khoang trang -> khong co doan nao', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('van ban ngan hon chunkSize -> dung 1 doan', () => {
    expect(chunkText('Xin chào thế giới.')).toEqual(['Xin chào thế giới.']);
  });

  it('van ban dai: moi doan <= chunkSize, 2 doan lien tiep chong lan nhau, phu het noi dung', () => {
    const sentence = 'Nhân viên phải đăng ký làm việc từ xa trước 17 giờ thứ Sáu hằng tuần. ';
    const text = sentence.repeat(60).trim();
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(CHUNK_SIZE);
    // Doan dau bat dau dung dau van ban, doan cuoi ket thuc dung cuoi van ban.
    expect(text.startsWith(chunks[0])).toBe(true);
    expect(text.endsWith(chunks[chunks.length - 1])).toBe(true);
    // Chong lan: dau doan sau (nam trong ~CHUNK_OVERLAP ky tu cuoi doan truoc) xuat hien lai o doan truoc.
    for (let i = 1; i < chunks.length; i++) {
      const head = chunks[i].slice(0, CHUNK_OVERLAP / 5);
      expect(chunks[i - 1].slice(-CHUNK_OVERLAP)).toContain(head);
    }
  });

  it('uu tien cat tai ranh gioi cau (khong cat ngang 1 tu)', () => {
    const sentence = 'Câu thứ nhất nói về chính sách bảo mật thông tin nội bộ. ';
    const chunks = chunkText(sentence.repeat(30));
    for (const chunk of chunks.slice(0, -1)) expect(chunk.endsWith('.')).toBe(true);
  });

  it('chuoi dai khong co khoang trang van tien trien (khong lap vo han), cat cung theo chunkSize', () => {
    const chunks = chunkText('a'.repeat(2000), 800, 100);
    expect(chunks.length).toBe(3);
    expect(chunks.every((chunk) => chunk.length <= 800)).toBe(true);
  });

  // 24/10/2026 (fix kiem thu RAG): findBoundary chi tim trong cua so - truoc day O(n^2) (9MB ~38s).
  it('van ban lon khong co dong trong: chia tuyen tinh (nhanh), van cat tai ranh gioi cau', () => {
    const text = 'Nhân viên kiểm kê hàng tồn kho mỗi sáng và báo cáo trước 10 giờ. '.repeat(60_000); // ~4MB (ban cu: ~7s)
    const startedAt = Date.now();
    const chunks = chunkText(text);
    expect(Date.now() - startedAt).toBeLessThan(2_000);
    expect(chunks.length).toBeGreaterThan(4_000);
    expect(chunks.slice(0, -1).every((chunk) => chunk.endsWith('.') && chunk.length <= CHUNK_SIZE)).toBe(true);
  });

  it('tu choi overlap >= chunkSize', () => {
    expect(() => chunkText('abc', 100, 100)).toThrow();
  });
});
