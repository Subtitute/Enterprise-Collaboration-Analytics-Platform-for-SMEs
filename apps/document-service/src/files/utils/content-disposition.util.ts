/**
 * Dung header `Content-Disposition` cho URL tai file MinIO (Technical_Spec.md muc 3.4, bo sung
 * 22/07/2026 - tach 2 hanh dong ro rang o FE: "Xem" (inline, trinh duyet tu render neu ho tro
 * - PDF/anh/text) vs "Tai xuong" (attachment, luon mo hop thoai Luu tap tin). `filename*` theo
 * RFC 5987 de ten file co dau tieng Viet van hien thi dung khi trinh duyet luu xuong.
 */
export function buildContentDisposition(type: 'inline' | 'attachment', fileName: string): string {
  // 22/07/2026: Fix 6 (code review) - bo sung strip `\` ben canh `"` da co. Fallback ASCII nam
  // trong cap dau nhay kep (`filename="..."`, RFC 6266 quoted-string) - thieu buoc nay, 1 ten
  // file ket thuc bang `\` ngay truoc dau `"` dong (vd ten file "abc\") co the khien 1 so
  // trinh duyet/thu vien HTTP cu hon (parser khong nghiem ngat theo dung quoted-string cua RFC
  // 6266, vi du coi `\"` la 1 dau `"` duoc escape) hieu sai ranh gioi cua thuoc tinh filename.
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
  const encoded = encodeRfc5987ValueChars(fileName);
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

// 22/07/2026: Fix 6 (code review) - `encodeURIComponent` KHONG ma hoa 5 ky tu `! * ' ( )`, trong
// khi grammar `attr-char` cua RFC 5987 (dung cho gia tri `filename*=UTF-8''...`) LOAI TRU ca 5
// ky tu nay khoi tap duoc phep dung KHONG ma hoa o vi tri nay: attr-char = token TRU `* ' %`, va
// ban than "token" (RFC 7230 muc 3.2.6) von di KHONG bao gom `(` `)`. De sot cac ky tu nay co the
// khien 1 so trinh duyet/thu vien phan tich header sai (vd `'` bi hieu nham la ranh gioi trong
// cac parser long leo hon voi tham so co dau nhay don).
function encodeRfc5987ValueChars(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}
