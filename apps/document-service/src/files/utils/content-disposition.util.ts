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

// 22/07/2026: Fix 6 (code review) - `encodeURIComponent` KHONG ma hoa 5 ky tu `! * ' ( )`, nen ham
// duoi day ma hoa bo sung ca 5 ky tu do cho gia tri dat sau `filename*=UTF-8''` (RFC 5987).
// 25/07/2026: MINOR fix (audit round) - sua lai LY DO cho DUNG RFC 5987 (comment ban dau ghi sai,
// hanh vi CODE khong doi): grammar `attr-char` = token (RFC 7230 muc 3.2.6) TRU `* ' %` - tuc CHI
// 3 ky tu nay bi loai tru khoi attr-char, KHONG phai ca 5 nhu comment cu tung ghi. `(` va `)`
// khong hop le don gian vi ban than "token" von di KHONG bao gom 2 ky tu nay tu dau (chung la
// delimiter cua RFC 7230, chua bao gio thuoc token) - khong lien quan gi den dinh nghia rieng cua
// attr-char. RIENG `!` THUC RA LA attr-char HOP LE theo dung liet ke cua RFC 5987 (KHONG bi loai
// tru), tuc KHONG bat buoc phai ma hoa - ham nay van ma hoa no theo kieu "phong thu them"
// (defense-in-depth, phong truong hop 1 so parser khong tuan thu chuan nghiem ngat). Dieu nay VAN
// AN TOAN (ma hoa 1 ky tu von khong bat buoc ma hoa khong gay hai gi), chi la ly do giai thich cu
// bi sai.
function encodeRfc5987ValueChars(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}
