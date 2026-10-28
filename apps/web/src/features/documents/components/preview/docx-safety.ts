// 27/10/2026: lop "lam sach" ket qua cua docx-preview TRUOC khi gan vao DOM that. docx-preview tu
// dung phan tu bang document.createElement (khong innerHTML noi dung tep) nhung van co 2 duong nguy
// hiem: (1) lien ket ngoai lay nguyen Target trong tep -> co the la "javascript:..." -> chi giu
// http/https/mailto (mo tab moi, rel="noopener noreferrer"), lien ket noi bo "#..." giu nguyen, con
// lai bo href; (2) altChunk (HTML nhung trong .docx) duoc render thanh <iframe srcdoc> - da tat
// bang renderAltChunks: false, o day xoa them moi phan tu nhung/script phong khi thu vien doi hanh vi.
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const BLOCKED_SELECTOR = 'script, iframe, frame, object, embed, form, base, meta, link';

export function hardenDocxOutput(root: ParentNode): void {
  root.querySelectorAll(BLOCKED_SELECTOR).forEach((el) => el.remove());
  root.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('#') && href.length > 1) return;
    let safe = false;
    try {
      safe = SAFE_PROTOCOLS.has(new URL(href).protocol);
    } catch {
      safe = false;
    }
    if (safe) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    } else {
      a.removeAttribute('href');
    }
  });
}
