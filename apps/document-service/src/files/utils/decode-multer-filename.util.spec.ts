// 16/09/2026: file moi - test cho decodeMulterFilename (sua loi ten file tieng Viet bi mojibake
// khi tai len, xem giai thich day du o decode-multer-filename.util.ts).
import { decodeMulterFilename } from './decode-multer-filename.util';

/** Mo phong dung hanh vi loi cua Busboy: giai ma nham 1 chuoi UTF-8 nhu the no la Latin-1. */
function toMojibake(realUtf8Name: string): string {
  return Buffer.from(realUtf8Name, 'utf8').toString('latin1');
}

describe('decodeMulterFilename (sua ten file tieng Viet bi mojibake khi tai len - 16/09/2026)', () => {
  it('phuc hoi dung ten file tieng Viet co dau bi Busboy giai ma nham la Latin-1', () => {
    const realName = 'Biểu mẫu_Quy Định Tổ chức và đánh giá TTTN HUCE.docx';
    const mojibake = toMojibake(realName);

    expect(mojibake).not.toBe(realName);
    expect(decodeMulterFilename(mojibake)).toBe(realName);
  });

  it('giu nguyen ten file thuan ASCII (khong bi anh huong boi buoc doi ma)', () => {
    expect(decodeMulterFilename('bao-cao-quy-2.pdf')).toBe('bao-cao-quy-2.pdf');
  });

  it('giu nguyen chuoi goc neu ket qua sau khi doi sinh ra ky tu thay the (khong phai truong hop bi hieu nham)', () => {
    const alreadyCorrect = 'Báo cáo tháng 7.docx';
    expect(decodeMulterFilename(alreadyCorrect)).toBe(alreadyCorrect);
  });

  it('khong lam thay doi chuoi goc truyen vao (khong co side-effect)', () => {
    const realName = 'Biểu mẫu HUCE.docx';
    const mojibake = toMojibake(realName);
    decodeMulterFilename(mojibake);
    expect(mojibake).toBe(toMojibake(realName));
  });
});
