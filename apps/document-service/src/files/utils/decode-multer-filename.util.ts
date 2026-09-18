// 16/09/2026: file moi - sua loi thuc te nguoi dung bao cao: ten file tieng Viet co dau khi tai
// len (vd "Biểu mẫu_Quy Định Tổ chức...docx") bi hien thi sai kieu "Biá»u máº«u_Quy Ä‘á»‹nh..."
// (loi "mojibake" kinh dien) sau khi luu vao DB va hien lai o FE. Nguyen nhan: Busboy (thu vien
// Multer dung ben trong, xem FileInterceptor o files.controller.ts) mac dinh giai ma tham so
// `filename` cua header multipart theo 'latin1' (dung quy uoc cu RFC 2388), trong khi trinh duyet
// hien dai (Chrome/Firefox/Edge) gui THANG byte UTF-8 trong tham so nay ma KHONG kem khai bao
// charset (khong dung cu phap RFC 2231 `filename*=UTF-8''...`) - ket qua la chuoi UTF-8 dung bi
// doc nham thanh Latin-1.
//
// Ham nay dao nguoc buoc giai ma sai: doc lai chuoi (dang bi hieu nham la Latin-1) ra dung byte
// goc, roi giai ma dung lai byte do la UTF-8. Co 1 lop bao ve: neu ket qua sau khi doi chua ky tu
// thay the U+FFFD (nghia la chuoi goc KHONG phai truong hop bi hieu nham - vd truong hop hiem gap
// trinh duyet cu da tu dung RFC 2231 va Busboy giai ma dung tu dau) thi GIU NGUYEN chuoi goc, tranh
// lam hong 1 ten file dang dung san.
//
// Ham thuan, khong phu thuoc Multer/Nest - de unit test doc lap (cung quy uoc voi
// sanitize-filename.util.ts).
export function decodeMulterFilename(originalName: string): string {
  const fixed = Buffer.from(originalName, 'latin1').toString('utf8');
  return fixed.includes('�') ? originalName : fixed;
}
