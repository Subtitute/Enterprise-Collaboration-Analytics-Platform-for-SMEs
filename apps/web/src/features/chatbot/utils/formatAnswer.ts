// 24/10/2026: tach cau tra loi cua Chat bot (LLM thuong tra ve markdown nhe: **dam**, gach dau dong
// "* "/"- ", tieu de "#") thanh cac khoi co cau truc de ChatbotAnswer.tsx render bang phan tu React -
// KHONG dung dangerouslySetInnerHTML: noi dung cau tra loi co the chua nguyen van trich doan tai lieu
// do nguoi dung khac tai len (du lieu khong dang tin), render dang text thuan nen khong the chen HTML/JS.
// Chi ho tro dung tap con markdown model hay dung - phan con lai hien nguyen van, khong mat noi dung.

export type AnswerBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: { depth: number; text: string }[] };

export interface InlineToken {
  kind: 'text' | 'bold' | 'code';
  text: string;
}

const BULLET_RE = /^(\s*)[*\-•]\s+(.*)$/;
const HEADING_RE = /^#{1,6}\s+(.*)$/;
const INLINE_RE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
const MAX_LIST_DEPTH = 3;

export function parseAnswerBlocks(content: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let paragraph: string[] = [];
  let list: { depth: number; text: string }[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length > 0) blocks.push({ kind: 'list', items: list });
    list = [];
  };

  for (const rawLine of content.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trimEnd();
    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      flushParagraph();
      list.push({ depth: Math.min(Math.floor(bullet[1].length / 2), MAX_LIST_DEPTH), text: bullet[2] });
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = HEADING_RE.exec(line.trim());
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'heading', text: heading[1] });
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  for (const part of text.split(INLINE_RE)) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      tokens.push({ kind: 'bold', text: part.slice(2, -2) });
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      tokens.push({ kind: 'code', text: part.slice(1, -1) });
    } else {
      tokens.push({ kind: 'text', text: part });
    }
  }
  return tokens;
}
