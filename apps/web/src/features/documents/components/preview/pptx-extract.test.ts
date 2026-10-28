// 27/10/2026: test trich chu .pptx (ban xem gian luoc) - fixture .pptx toi gian tao trong bo nho bang fflate.
import { strToU8, zipSync } from 'fflate';
import { extractPptxSlides } from './pptx-extract';
import { OfficeZipError } from './office-zip';

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ' +
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';

const run = (text: string) => `<a:r><a:rPr lang="vi-VN"/><a:t>${text}</a:t></a:r>`;
const para = (inner: string, lvl?: number) => `<a:p>${lvl !== undefined ? `<a:pPr lvl="${lvl}"/>` : ''}${inner}</a:p>`;
const shape = (body: string, phType?: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"/><p:cNvSpPr/><p:nvPr>${phType ? `<p:ph type="${phType}"/>` : ''}</p:nvPr></p:nvSpPr>` +
  `<p:spPr/><p:txBody><a:bodyPr/>${body}</p:txBody></p:sp>`;
const slideXml = (tree: string) => `<?xml version="1.0" encoding="UTF-8"?><p:sld ${NS}><p:cSld><p:spTree>${tree}</p:spTree></p:cSld></p:sld>`;

function buildPptx(slides: Record<string, string>, order: string[] | null): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'ppt/presentation.xml': strToU8(
      `<p:presentation ${NS}><p:sldIdLst>${(order ?? [])
        .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 10}"/>`)
        .join('')}</p:sldIdLst></p:presentation>`,
    ),
    'ppt/_rels/presentation.xml.rels': strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${(order ?? [])
        .map(
          (target, i) =>
            `<Relationship Id="rId${i + 10}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="${target}"/>`,
        )
        .join('')}</Relationships>`,
    ),
    'ppt/notesSlides/notesSlide1.xml': strToU8(slideXml(shape(para(run('Ghi chú không hiển thị'))))),
  };
  for (const [name, xml] of Object.entries(slides)) files[name] = strToU8(xml);
  return zipSync(files);
}

describe('extractPptxSlides', () => {
  it('follows presentation.xml order and extracts title + paragraphs with levels', () => {
    const data = buildPptx(
      {
        'ppt/slides/slide1.xml': slideXml(
          shape(para(run('Nội dung trình bày')), 'title') +
            shape(para(run('Mục tiêu quý III')) + para(run('Doanh thu ') + run('tăng 15%'), 1) + para('')) +
            shape(para('<a:fld id="{1}" type="slidenum"><a:t>2</a:t></a:fld>')) +
            shape(para(run('12/10/2026')), 'dt'),
        ),
        'ppt/slides/slide2.xml': slideXml(shape(para(run('Báo cáo KPI')), 'ctrTitle') + shape(para(run('Ban giám đốc')), 'subTitle')),
      },
      // slide2.xml dung TRUOC slide1.xml trong muc luc
      ['slides/slide2.xml', '/ppt/slides/slide1.xml'],
    );
    const slides = extractPptxSlides(data);
    expect(slides).toEqual([
      { index: 1, title: 'Báo cáo KPI', paragraphs: [{ text: 'Ban giám đốc', level: 0 }] },
      {
        index: 2,
        title: 'Nội dung trình bày',
        paragraphs: [
          { text: 'Mục tiêu quý III', level: 0 },
          { text: 'Doanh thu tăng 15%', level: 1 },
        ],
      },
    ]);
  });

  it('reads grouped shapes, tables, AlternateContent fallbacks and line breaks', () => {
    const table =
      '<p:graphicFrame><a:graphic><a:graphicData><a:tbl>' +
      `<a:tr><a:tc><a:txBody>${para(run('Chỉ số'))}</a:txBody></a:tc><a:tc><a:txBody>${para(run('Giá trị'))}</a:txBody></a:tc></a:tr>` +
      `<a:tr><a:tc><a:txBody>${para(run('NPS'))}</a:txBody></a:tc><a:tc><a:txBody>${para(run('62'))}</a:txBody></a:tc></a:tr>` +
      '</a:tbl></a:graphicData></a:graphic></p:graphicFrame>';
    const data = buildPptx(
      {
        'ppt/slides/slide1.xml': slideXml(
          `<p:grpSp>${shape(para(run('Dòng 1') + '<a:br/>' + run('Dòng 2')))}</p:grpSp>` +
            table +
            `<mc:AlternateContent><mc:Choice Requires="x">${shape(para(run('Choice')))}</mc:Choice>` +
            `<mc:Fallback>${shape(para(run('Fallback')))}</mc:Fallback></mc:AlternateContent>`,
        ),
      },
      ['slides/slide1.xml'],
    );
    const [slide] = extractPptxSlides(data);
    expect(slide.title).toBeNull();
    expect(slide.paragraphs.map((p) => p.text)).toEqual(['Dòng 1 Dòng 2', 'Chỉ số | Giá trị', 'NPS | 62', 'Fallback']);
  });

  it('falls back to numeric file order when the slide list is missing', () => {
    const data = buildPptx(
      {
        'ppt/slides/slide10.xml': slideXml(shape(para(run('Mười')), 'title')),
        'ppt/slides/slide2.xml': slideXml(shape(para(run('Hai')), 'title')),
      },
      null,
    );
    expect(extractPptxSlides(data).map((s) => s.title)).toEqual(['Hai', 'Mười']);
  });

  it('never returns markup: XML special characters stay plain text', () => {
    const data = buildPptx(
      { 'ppt/slides/slide1.xml': slideXml(shape(para(run('&lt;img src=x onerror=alert(1)&gt; &amp; co')))) },
      ['slides/slide1.xml'],
    );
    expect(extractPptxSlides(data)[0].paragraphs[0].text).toBe('<img src=x onerror=alert(1)> & co');
  });

  it('rejects archives that are not presentations', () => {
    const notPptx = zipSync({ 'word/document.xml': strToU8('<w:document/>') });
    expect(() => extractPptxSlides(notPptx)).toThrow(OfficeZipError);
    expect(() => extractPptxSlides(strToU8('garbage'))).toThrow(OfficeZipError);
  });
});
