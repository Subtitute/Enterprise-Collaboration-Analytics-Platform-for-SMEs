// 28/10/2026: chon bo du lieu demo theo nganh cho cac script seed (seed.js, seed-inventory.js,
// migrate-project-documents.js, seed-project-docs.js). Khong dat SEED_DATASET -> {} va moi script giu du
// lieu mac dinh (cong ty may tinh "Demo SME"). Vd SEED_DATASET=noi-that -> ./noi-that.js.
const path = require('path');
const JSZip = require('jszip'); // co san trong node_modules goc (phu thuoc cua document-service)

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function loadDataset() {
  const name = process.env.SEED_DATASET;
  if (!name) return {};
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`SEED_DATASET khong hop le: ${name}`);
  return require(path.join(__dirname, name));
}

const escapeXml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function paragraph(text, { bold = false, size } = {}) {
  const props = `${bold ? '<w:b/>' : ''}${size ? `<w:sz w:val="${size}"/>` : ''}`;
  return `<w:p><w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

/** DOCX toi thieu (tieu de + cac muc [tieu de muc, noi dung]) - du de xem truoc va de RAG lap chi muc. */
async function makeDocx(title, sections) {
  const body = [paragraph(title, { bold: true, size: 32 })];
  for (const [heading, text] of sections) body.push(paragraph(heading, { bold: true, size: 26 }), paragraph(text));
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}</w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

module.exports = { loadDataset, makeDocx, DOCX_MIME };
