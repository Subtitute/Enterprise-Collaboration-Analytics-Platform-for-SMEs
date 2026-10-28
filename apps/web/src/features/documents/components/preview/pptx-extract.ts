import { strFromU8 } from 'fflate';
import { unzipOfficeEntries } from './office-zip';

// 27/10/2026: ban xem GIAN LUOC cho .pptx - khong co thu vien render PowerPoint nhe nao chay thuan
// trinh duyet, nen chi trich chu: thu tu trang chieu lay tu ppt/presentation.xml (p:sldIdLst ->
// quan he r:id trong ppt/_rels/presentation.xml.rels), moi trang ppt/slides/slideN.xml lay tieu de
// (placeholder title/ctrTitle) + cac doan van (a:p -> a:t) theo thu tu cay hinh. XML chi duoc doc
// bang DOMParser (khong thuc thi gi, trinh duyet khong tai entity ngoai); ket qua render bang phan
// tu React (text node) - khong co innerHTML nao tu noi dung tep.
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

const PRESENTATION = 'ppt/presentation.xml';
const PRESENTATION_RELS = 'ppt/_rels/presentation.xml.rels';
const SLIDE_RE = /^ppt\/slides\/slide(\d+)\.xml$/;
// Placeholder so trang/ngay/chan trang cua mau - khong phai noi dung cua trang chieu.
const SKIPPED_PLACEHOLDERS = new Set(['sldNum', 'dt', 'ftr']);
const TITLE_PLACEHOLDERS = new Set(['title', 'ctrTitle']);

export interface PptxParagraph {
  text: string;
  /** Cap thut le (a:pPr lvl, 0 = cap dau dong ngoai cung). */
  level: number;
}

export interface PptxSlide {
  /** So thu tu hien thi (1-based, theo thu tu trong presentation.xml). */
  index: number;
  title: string | null;
  paragraphs: PptxParagraph[];
}

function parseXml(bytes: Uint8Array | undefined): Document | null {
  if (!bytes) return null;
  const doc = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
  return doc.getElementsByTagName('parsererror').length > 0 ? null : doc;
}

function childrenByName(parent: Element, ns: string, localName: string): Element[] {
  return Array.from(parent.children).filter((el) => el.namespaceURI === ns && el.localName === localName);
}

/** Chuan hoa duong dan Target (tuong doi voi thu muc ppt/, co the co '../' hoac '/'). */
function resolveTarget(target: string): string {
  const parts = target.startsWith('/') ? [] : ['ppt'];
  for (const seg of target.replace(/^\/+/, '').split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

/** Thu tu trang chieu theo presentation.xml; tep khong co muc luc hop le -> sap theo so trong ten. */
function slideOrder(files: Record<string, Uint8Array>): string[] {
  const slideNames = Object.keys(files).filter((name) => SLIDE_RE.test(name));
  const pres = parseXml(files[PRESENTATION]);
  const rels = parseXml(files[PRESENTATION_RELS]);
  if (pres && rels) {
    const targets = new Map<string, string>();
    for (const rel of Array.from(rels.getElementsByTagNameNS(NS_PKG_REL, 'Relationship'))) {
      targets.set(rel.getAttribute('Id') ?? '', resolveTarget(rel.getAttribute('Target') ?? ''));
    }
    const ordered = Array.from(pres.getElementsByTagNameNS(NS_P, 'sldId'))
      .map((sld) => targets.get(sld.getAttributeNS(NS_R, 'id') ?? ''))
      .filter((name): name is string => Boolean(name && files[name]));
    if (ordered.length > 0) return ordered;
  }
  const num = (name: string) => Number(SLIDE_RE.exec(name)?.[1] ?? 0);
  return slideNames.sort((a, b) => num(a) - num(b));
}

/** Noi dung chu cua 1 doan a:p: a:r/a:t + a:fld/a:t (tru truong so trang), a:br -> khoang trang. */
function paragraphText(p: Element): string {
  let text = '';
  for (const node of Array.from(p.children)) {
    if (node.namespaceURI !== NS_A) continue;
    if (node.localName === 'br') text += ' ';
    else if (node.localName === 'r' || (node.localName === 'fld' && node.getAttribute('type') !== 'slidenum')) {
      text += childrenByName(node, NS_A, 't').map((t) => t.textContent ?? '').join('');
    }
  }
  return text.replace(/\s+/g, ' ').trim();
}

function paragraphsOf(container: Element): PptxParagraph[] {
  const result: PptxParagraph[] = [];
  for (const p of Array.from(container.getElementsByTagNameNS(NS_A, 'p'))) {
    const text = paragraphText(p);
    if (!text) continue;
    const pPr = childrenByName(p, NS_A, 'pPr')[0];
    result.push({ text, level: Math.min(Number(pPr?.getAttribute('lvl') ?? 0) || 0, 8) });
  }
  return result;
}

/** Duyet cay hinh (p:spTree) theo thu tu: hinh co chu, nhom hinh (de quy), bang trong graphicFrame. */
function walkShapes(tree: Element, slide: { title: string[]; paragraphs: PptxParagraph[] }): void {
  for (const el of Array.from(tree.children)) {
    // mc:AlternateContent (PowerPoint boc cac hinh dung tinh nang moi) -> doc nhanh Fallback (hoac Choice).
    if (el.namespaceURI === NS_MC && el.localName === 'AlternateContent') {
      const branch = childrenByName(el, NS_MC, 'Fallback')[0] ?? childrenByName(el, NS_MC, 'Choice')[0];
      if (branch) walkShapes(branch, slide);
      continue;
    }
    if (el.namespaceURI !== NS_P) continue;
    if (el.localName === 'grpSp') {
      walkShapes(el, slide);
    } else if (el.localName === 'sp') {
      const phType = el.getElementsByTagNameNS(NS_P, 'ph')[0]?.getAttribute('type') ?? '';
      if (SKIPPED_PLACEHOLDERS.has(phType)) continue;
      const paragraphs = paragraphsOf(el);
      if (TITLE_PLACEHOLDERS.has(phType) && slide.title.length === 0) {
        slide.title.push(...paragraphs.map((p) => p.text));
      } else {
        slide.paragraphs.push(...paragraphs);
      }
    } else if (el.localName === 'graphicFrame') {
      // Bang: moi dong -> 1 dong chu, cac o noi bang " | ".
      for (const tr of Array.from(el.getElementsByTagNameNS(NS_A, 'tr'))) {
        const cells = childrenByName(tr, NS_A, 'tc').map((tc) =>
          paragraphsOf(tc)
            .map((p) => p.text)
            .join(' '),
        );
        const line = cells.filter(Boolean).join(' | ');
        if (line) slide.paragraphs.push({ text: line, level: 0 });
      }
    }
  }
}

/**
 * Trich tieu de + doan van cua tung trang chieu. Chi giai nen presentation.xml, rels cua no va
 * ppt/slides/slideN.xml (bo qua media, bieu do, ghi chu) sau khi qua chot chan zip bomb.
 */
export function extractPptxSlides(data: Uint8Array): PptxSlide[] {
  const files = unzipOfficeEntries(
    data,
    (name) => name === PRESENTATION || name === PRESENTATION_RELS || SLIDE_RE.test(name),
    PRESENTATION,
  );
  return slideOrder(files).map((name, i) => {
    const slide = { title: [] as string[], paragraphs: [] as PptxParagraph[] };
    const tree = parseXml(files[name])?.getElementsByTagNameNS(NS_P, 'spTree')[0];
    if (tree) walkShapes(tree, slide);
    return { index: i + 1, title: slide.title.length > 0 ? slide.title.join(' ') : null, paragraphs: slide.paragraphs };
  });
}
