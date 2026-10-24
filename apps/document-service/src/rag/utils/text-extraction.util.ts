/**
 * 24/10/2026: trich van ban thuan tu noi dung file de nhung (embedding) cho RAG. CHI ho tro nhom
 * dinh dang van ban pho bien nhat cua tai lieu noi bo - loai khac (anh, zip, .doc/.xls/.ppt nhi phan
 * cu, .xlsx/.pptx) bi BO QUA im lang (tra ve null), file van tai/xem binh thuong, chi khong tim kiem
 * ngu nghia duoc.
 *
 * Thu vien: `unpdf` (PDF - ban dong goi pdf.js khong phu thuoc canvas/native binary, co entry
 * CommonJS that su nen chay duoc voi "module": "commonjs" cua service nay - da kiem chung tren
 * node:20-alpine) va `mammoth` (DOCX). Ca 2 duoc `import()` LUOI (lazy) ben trong ham: chi nap vao bo
 * nho khi that su gap file PDF/DOCX, khong lam cham khoi dong service.
 */
const TEXT_MIME_TYPES = new Set(['text/plain', 'text/csv', 'text/markdown']);
const PDF_MIME_TYPE = 'application/pdf';
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
// 24/10/2026: tran TONG kich thuoc giai nen (khai bao trong central directory) cua 1 DOCX truoc khi
// giao cho mammoth - chan "zip bomb" (vai MB nen -> hang GB XML, mammoth/jszip giai nen het vao RAM).
export const MAX_DOCX_UNCOMPRESSED_BYTES = 30 * 1024 * 1024;

export function isIndexableMimeType(mimeType: string): boolean {
  return TEXT_MIME_TYPES.has(mimeType) || mimeType === PDF_MIME_TYPE || mimeType === DOCX_MIME_TYPE;
}

/**
 * Doan dau (toi da `maxChars` ky tu) van ban cua file, hoac null neu loai file khong ho tro / file
 * khai bao van ban nhung that ra la nhi phan. NEM LOI khi noi dung PDF/DOCX hong - noi goi
 * (DocumentIndexerService) coi do la loi VINH VIEN cua file, khong thu lai.
 *
 * 24/10/2026 (fix kiem thu RAG): bo sung `maxChars` - truoc day trich TOAN BO van ban roi moi cat con
 * 100 doan o buoc sau (do song: 1 file .txt 3,5MB day RAM document-service tu ~85MB len ~180MB, 100%
 * CPU vai giay; file 10MB con ton gap 3). Gio chi giai ma/trich toi muc can dung; PDF doc TUAN TU tung
 * trang va dung som, thay cho unpdf.extractText() (nap MOI trang SONG SONG bang Promise.all). Kem
 * theo: file text/* chua byte NUL hoac nhieu ky tu loi UTF-8 (nhi phan doi duoi .txt) -> null, khong
 * nhung "rac" ton han ngach Gemini.
 */
export async function extractText(buffer: Buffer, mimeType: string, maxChars = Number.MAX_SAFE_INTEGER): Promise<string | null> {
  if (TEXT_MIME_TYPES.has(mimeType)) {
    // UTF-8: 1 ky tu <= 4 byte - chi giai ma toi da maxChars*4 byte dau, khong giai ma ca buffer.
    const head = buffer.subarray(0, Math.min(buffer.length, maxChars * 4));
    if (looksBinary(head)) return null;
    return head.toString('utf8').slice(0, maxChars);
  }
  if (mimeType === PDF_MIME_TYPE) {
    return extractPdfText(buffer, maxChars);
  }
  if (mimeType === DOCX_MIME_TYPE) {
    const declaredBytes = zipUncompressedSize(buffer);
    if (declaredBytes === null) throw new Error('DOCX khong doc duoc central directory (ZIP hong hoac ZIP64)');
    if (declaredBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
      throw new Error(`DOCX giai nen ra ${declaredBytes} byte, vuot tran ${MAX_DOCX_UNCOMPRESSED_BYTES} byte (nghi zip bomb)`);
    }
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer });
    return value.slice(0, maxChars);
  }
  return null;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const EOCD_MIN_BYTES = 22;
const CENTRAL_HEADER_BYTES = 46;

/**
 * 24/10/2026: tong kich thuoc GIAI NEN khai bao cua moi muc trong 1 file ZIP, doc thang tu End Of
 * Central Directory + central directory (khong giai nen, khong them thu vien). null neu khong doc duoc
 * hoac la ZIP64 (DOCX <= 10MB khong can ZIP64 - coi nhu bat thuong). Gioi han da biet: kich thuoc
 * khai bao co the bi lam gia; lop bao ve cuoi cung la co "dang trich" o DocumentIndexerService (OOM giua
 * chung khong gay vong lap crash-restart).
 */
export function zipUncompressedSize(buffer: Buffer): number | null {
  if (buffer.length < EOCD_MIN_BYTES) return null;
  const searchFloor = Math.max(0, buffer.length - EOCD_MIN_BYTES - 0xffff);
  let eocd = -1;
  for (let i = buffer.length - EOCD_MIN_BYTES; i >= searchFloor; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const entries = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (entries === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) return null;
  if (directoryOffset + directorySize > eocd) return null;

  let total = 0;
  let offset = directoryOffset;
  for (let n = 0; n < entries; n++) {
    if (offset + CENTRAL_HEADER_BYTES > eocd || buffer.readUInt32LE(offset) !== CENTRAL_HEADER_SIGNATURE) return null;
    const uncompressed = buffer.readUInt32LE(offset + 24);
    if (uncompressed === 0xffffffff) return null;
    total += uncompressed;
    offset += CENTRAL_HEADER_BYTES + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  return total;
}

const BINARY_SNIFF_BYTES = 8000;
const MAX_REPLACEMENT_CHAR_RATIO = 0.1;

/** Heuristic kieu git: co byte NUL trong 8000 byte dau, hoac >10% ky tu khong giai ma duoc UTF-8. */
export function looksBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, BINARY_SNIFF_BYTES);
  if (sample.length === 0) return false;
  if (sample.includes(0)) return true;
  const decoded = sample.toString('utf8');
  let replacement = 0;
  for (const char of decoded) if (char === '�') replacement++;
  return replacement / decoded.length > MAX_REPLACEMENT_CHAR_RATIO;
}

/** Ghep van ban tung trang giong unpdf.extractText (hasEOL -> xuong dong, cac trang noi bang '\n'). */
async function extractPdfText(buffer: Buffer, maxChars: number): Promise<string> {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  try {
    const pages: string[] = [];
    let total = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages && total < maxChars; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : '')).join('');
      page.cleanup();
      pages.push(text);
      total += text.length + 1;
    }
    return pages.join('\n').slice(0, maxChars);
  } finally {
    await pdf.loadingTask.destroy();
  }
}
