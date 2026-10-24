// 24/10/2026: sinh lai bo file mau cho kich ban tai lieu (04-documents.js) vao thu muc fixtures/:
// PDF/DOCX hop le (co noi dung de thu RAG), PDF/DOCX hong (trinh trich van ban phai bo qua an toan),
// DOCX "zip bomb" (word/document.xml ~70MB nen con ~140KB - kiem tra gioi han giai nen). Cac file nay
// da duoc commit san; chi can chay lai khi muon tao moi: node scripts/mock-data/mkfixtures.js
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip'); // co san trong node_modules goc (phu thuoc cua document-service)
const out = path.join(__dirname, 'fixtures');
fs.mkdirSync(out, { recursive: true });

// PDF toi thieu 1 trang, font Helvetica (chi ASCII)
function makePdf(lines) {
  const content = 'BT /F1 12 Tf 50 750 Td 14 TL ' + lines.map((l) => `(${l.replace(/[()\\]/g, '')}) Tj T*`).join(' ') + ' ET';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
fs.writeFileSync(path.join(out, 't1-quy-dinh-bao-mat.pdf'), makePdf([
  'Quy dinh bao mat phong thi nghiem Kim Cuong Do:',
  'Moi khach tham quan phai deo the tu mau cam va ky so nhat ky tai cong so 3.',
  'Ma truy cap phong may chu la LAB-7731, thay doi vao ngay mung 1 hang thang.',
]));
fs.writeFileSync(path.join(out, 't1-hong.pdf'), Buffer.from('%PDF-1.7\nday khong phai la PDF that su, chi la chuoi rac de thu trinh trich van ban\n%%EOF'));

(async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const paras = [
    'Sổ tay phúc lợi nhân viên Hải Đăng Tím:',
    'Mỗi nhân viên chính thức được hỗ trợ 2 triệu đồng tiền gửi xe mỗi quý.',
    'Gói khám sức khỏe định kỳ thực hiện tại phòng khám Bình Minh vào tháng 9.',
  ];
  zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    paras.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('') + '</w:body></w:document>');
  fs.writeFileSync(path.join(out, 't1-so-tay-phuc-loi.docx'), await zip.generateAsync({ type: 'nodebuffer' }));
  // DOCX hong: zip hop le nhung thieu word/document.xml
  const bad = new JSZip();
  bad.file('hello.txt', 'khong phai docx');
  fs.writeFileSync(path.join(out, 't1-hong.docx'), await bad.generateAsync({ type: 'nodebuffer' }));
  // Zip bomb: 1 file XML 70MB toan ky tu lap -> nen DEFLATE con ~140KB
  const bomb = new JSZip();
  bomb.file('[Content_Types].xml', '<Types/>');
  bomb.file('word/document.xml', 'A'.repeat(70 * 1000 * 1000));
  fs.writeFileSync(path.join(out, 't1-zip-bomb.docx'), await bomb.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }));
  console.log('fixtures ok');
})();
