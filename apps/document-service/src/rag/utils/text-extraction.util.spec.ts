// 24/10/2026: unit test trich van ban cho RAG (text-extraction.util.ts). `unpdf`/`mammoth` duoc mock:
// ban CJS cua unpdf tu nap bundle pdf.js bang import() dong - Jest (VM CommonJS, khong bat
// --experimental-vm-modules) khong chay duoc loi goi do, trong khi Node that chay binh thuong (da kiem
// chung tren node:20-alpine + smoke test song qua Gateway). O day chi khoa lai "noi day" dung API.
// 24/10/2026 (fix kiem thu RAG): PDF gio doc TUNG TRANG qua getDocumentProxy (khong con unpdf.extractText),
// bo sung test maxChars + nhan dien file nhi phan doi duoi .txt.
import { MAX_DOCX_UNCOMPRESSED_BYTES, extractText, isIndexableMimeType, looksBinary, zipUncompressedSize } from './text-extraction.util';

/**
 * ZIP toi thieu dung tay (chi central directory + EOCD - du cho zipUncompressedSize; noi dung that do
 * mammoth doc da duoc mock). `declared` = kich thuoc giai nen khai bao cua tung muc.
 */
function fakeZip(entries: { name: string; declared: number }[], comment = ''): Buffer {
  const central = entries.map(({ name, declared }) => {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt32LE(Math.min(declared, 1000), 20);
    header.writeUInt32LE(declared, 24);
    header.writeUInt16LE(Buffer.byteLength(name), 28);
    return Buffer.concat([header, Buffer.from(name)]);
  });
  const directory = Buffer.concat(central);
  const localData = Buffer.from('PK du lieu nen gia lap');
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(localData.length, 16);
  eocd.writeUInt16LE(Buffer.byteLength(comment), 20);
  return Buffer.concat([localData, directory, eocd, Buffer.from(comment)]);
}
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const PDF_PAGES = ['QUY TRINH BAO MAT', 'Mat khau toi thieu 12 ky tu', 'Trang 3 khong can doc'];
const pdfPage = (text: string) => ({
  getTextContent: jest.fn().mockResolvedValue({ items: [{ str: text, hasEOL: false }, { type: 'beginMarkedContent' }] }),
  cleanup: jest.fn(),
});
const pdfProxy = {
  numPages: PDF_PAGES.length,
  getPage: jest.fn((n: number) => Promise.resolve(pdfPage(PDF_PAGES[n - 1]))),
  loadingTask: { destroy: jest.fn().mockResolvedValue(undefined) },
};
jest.mock('unpdf', () => ({
  getDocumentProxy: jest.fn(() => Promise.resolve(pdfProxy)),
}));
jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockResolvedValue({ value: 'Biên bản họp giao ban', messages: [] }),
}));

describe('isIndexableMimeType', () => {
  it('ho tro txt/csv/md/pdf/docx, bo qua anh/zip/office nhi phan cu', () => {
    expect(isIndexableMimeType('text/plain')).toBe(true);
    expect(isIndexableMimeType('text/csv')).toBe(true);
    expect(isIndexableMimeType('text/markdown')).toBe(true);
    expect(isIndexableMimeType('application/pdf')).toBe(true);
    expect(isIndexableMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    expect(isIndexableMimeType('image/png')).toBe(false);
    expect(isIndexableMimeType('application/zip')).toBe(false);
    expect(isIndexableMimeType('application/msword')).toBe(false);
  });
});

describe('extractText', () => {
  beforeEach(() => jest.clearAllMocks());

  it('doc van ban thuan UTF-8 (giu dau tieng Viet)', async () => {
    const text = await extractText(Buffer.from('Quy định làm việc từ xa', 'utf8'), 'text/plain');
    expect(text).toBe('Quy định làm việc từ xa');
  });

  it('van ban thuan: chi tra ve toi da maxChars ky tu dau', async () => {
    expect(await extractText(Buffer.from('Quy định làm việc từ xa', 'utf8'), 'text/plain', 7)).toBe('Quy địn');
  });

  it('file khai bao text/plain nhung la nhi phan -> null (khong nhung rac)', async () => {
    expect(await extractText(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x41]), 'text/plain')).toBeNull();
  });

  it('loai file khong ho tro -> null (bo qua im lang)', async () => {
    expect(await extractText(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/png')).toBeNull();
  });

  it('PDF: doc tung trang qua getDocumentProxy(Uint8Array), noi trang bang xuong dong, luon destroy', async () => {
    const unpdf = jest.requireMock('unpdf') as { getDocumentProxy: jest.Mock };
    const text = await extractText(Buffer.from('%PDF-1.4'), 'application/pdf');
    expect(text).toBe(PDF_PAGES.join('\n'));
    expect(unpdf.getDocumentProxy).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(pdfProxy.loadingTask.destroy).toHaveBeenCalled();
  });

  it('PDF: dung doc trang moi khi da du maxChars (khong nap ca tai lieu)', async () => {
    const text = await extractText(Buffer.from('%PDF-1.4'), 'application/pdf', 20);
    expect(text).toBe('QUY TRINH BAO MAT\nMa');
    expect(pdfProxy.getPage).toHaveBeenCalledTimes(2);
  });

  it('PDF hong: nem loi (noi goi coi la loi vinh vien), van destroy tai lieu da mo', async () => {
    pdfProxy.getPage.mockRejectedValueOnce(new Error('Invalid PDF structure.'));
    await expect(extractText(Buffer.from('%PDF-1.7 rac'), 'application/pdf')).rejects.toThrow('Invalid PDF structure.');
    expect(pdfProxy.loadingTask.destroy).toHaveBeenCalled();
  });

  it('DOCX: goi mammoth.extractRawText voi buffer', async () => {
    const mammoth = jest.requireMock('mammoth') as { extractRawText: jest.Mock };
    const buffer = fakeZip([{ name: 'word/document.xml', declared: 5_000 }, { name: '[Content_Types].xml', declared: 900 }]);
    const text = await extractText(buffer, DOCX);
    expect(text).toBe('Biên bản họp giao ban');
    expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer });
  });

  it('DOCX "zip bomb" (giai nen vuot tran) hoac ZIP hong: nem loi, KHONG goi mammoth', async () => {
    const mammoth = jest.requireMock('mammoth') as { extractRawText: jest.Mock };
    const bomb = fakeZip([{ name: 'word/document.xml', declared: MAX_DOCX_UNCOMPRESSED_BYTES + 1 }]);
    await expect(extractText(bomb, DOCX)).rejects.toThrow('zip bomb');
    await expect(extractText(Buffer.from('PK khong co EOCD'), DOCX)).rejects.toThrow('central directory');
    expect(mammoth.extractRawText).not.toHaveBeenCalled();
  });
});

describe('zipUncompressedSize', () => {
  it('cong kich thuoc giai nen khai bao cua moi muc (ke ca khi EOCD co comment)', () => {
    const zip = fakeZip([{ name: 'a.xml', declared: 1_234 }, { name: 'b.xml', declared: 4_000_000_000 }], 'ghi chu');
    expect(zipUncompressedSize(zip)).toBe(4_000_001_234);
  });

  it('khong phai ZIP / central directory tro ra ngoai buffer / ZIP64 -> null', () => {
    expect(zipUncompressedSize(Buffer.from('hello'))).toBeNull();
    const broken = fakeZip([{ name: 'a.xml', declared: 10 }]);
    broken.writeUInt32LE(0xffff, broken.length - 22 + 16); // offset central directory sai
    expect(zipUncompressedSize(broken)).toBeNull();
    expect(zipUncompressedSize(fakeZip([{ name: 'a.xml', declared: 0xffffffff }]))).toBeNull();
  });
});

describe('looksBinary', () => {
  it('van ban UTF-8 (ke ca tieng Viet) va file rong khong phai nhi phan', () => {
    expect(looksBinary(Buffer.from('Biên bản họp, ngày 24/10/2026\n', 'utf8'))).toBe(false);
    expect(looksBinary(Buffer.alloc(0))).toBe(false);
  });

  it('co byte NUL hoac qua nhieu byte khong hop le UTF-8 -> nhi phan', () => {
    expect(looksBinary(Buffer.from([0x41, 0x00, 0x42]))).toBe(true);
    expect(looksBinary(Buffer.from([0xff, 0xfe, 0xc3, 0x28, 0x41, 0xa0, 0xa1, 0x42]))).toBe(true);
  });
});
