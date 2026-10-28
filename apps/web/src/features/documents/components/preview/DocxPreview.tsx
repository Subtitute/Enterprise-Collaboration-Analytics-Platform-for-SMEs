import { useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { parseAsync, renderDocument, type Options } from 'docx-preview';
import { assertSafeOfficeZip } from './office-zip';
import { hardenDocxOutput } from './docx-safety';
import { PreviewLoadingOverlay } from './PreviewLoading';
import type { OfficePreviewProps } from './preview-type';

// 27/10/2026: xem truoc .docx bang thu vien docx-preview (Apache-2.0) - nap lazy tu FilePreviewModal
// nen chunk chinh khong lon them. Cau hinh an toan: anh nhung doi thanh data: URL (useBase64URL),
// bo font nhung (ignoreFonts), tat experimental/altChunk (HTML nhung -> iframe srcdoc)/binh luan/
// theo doi thay doi; ket qua render vao DocumentFragment, qua hardenDocxOutput() roi moi gan vao DOM.
const DOCX_OPTIONS: Partial<Options> = {
  className: 'docx',
  inWrapper: true,
  breakPages: true,
  ignoreFonts: true,
  useBase64URL: true,
  experimental: false,
  renderAltChunks: false,
  renderComments: false,
  renderChanges: false,
  debug: false,
};

// 28/10/2026: docx-preview dung the <style> bang cach NOI CHUOI gia tri lay tu tep (mau, font, ten
// style, lvlText danh so) va gan nguyen thuoc tinh style cua hinh VML -> 1 tep .docx doc hai "thoat"
// duoc khoi khoi CSS: doi giao dien ca trang ung dung, phu 1 lop position:fixed kin man hinh (che ca
// nut dong modal) va goi url(...) ra may chu ngoai (lo IP/thoi diem mo tep). Vi vay tai lieu nam trong
// 1 iframe sandbox KHONG co allow-scripts (khong script/handler nao chay duoc) voi CSP rieng chi cho
// style noi tuyen + anh/font data: -> moi tai nguyen ngoai bi chan, CSS va lop phu chi nam trong khung
// xem truoc. allow-same-origin chi de modal dua node vao iframe va nghe phim Escape (an toan vi khong
// co allow-scripts); allow-popups(-to-escape-sandbox) de lien ket http/https/mailto da loc van mo tab moi.
// <base href="about:srcdoc">: lien ket muc luc "#_Toc..." cuon trong chinh iframe, khong dieu huong iframe
// sang URL cua trang ung dung (URL goc mac dinh cua srcdoc la URL trang cha).
const FRAME_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:";
const FRAME_SRCDOC =
  `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}">` +
  '<base href="about:srcdoc"><style>html,body{margin:0;background:#E5E7EB}</style></head><body></body></html>';
const FRAME_SANDBOX = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox';

export default function DocxPreview({ data, onError }: OfficePreviewProps) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  // 28/10/2026: document cua iframe, resolve 1 lan khi srcdoc (co the CSP) nap xong.
  const [frame] = useState(() => {
    let resolve: (doc: Document) => void = () => undefined;
    const loaded = new Promise<Document>((done) => {
      resolve = done;
    });
    return { loaded, resolve };
  });

  const handleFrameLoad = (e: SyntheticEvent<HTMLIFrameElement>) => {
    const doc = e.currentTarget.contentDocument;
    // Chi nhan document srcdoc da co the CSP (bo qua about:blank ban dau neu trinh duyet bao load som).
    if (doc?.querySelector('meta[http-equiv="Content-Security-Policy"]')) frame.resolve(doc);
  };

  useEffect(() => {
    let cancelled = false;
    let target: Document | null = null;
    // Focus nam trong iframe thi phim Escape khong toi listener cua Modal -> chuyen tiep len trang chinh.
    const forwardEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    };
    setReady(false);
    (async () => {
      assertSafeOfficeZip(data, '[Content_Types].xml');
      const doc = await parseAsync(data, DOCX_OPTIONS);
      const frameDoc = await frame.loaded;
      const nodes = await renderDocument(doc, DOCX_OPTIONS);
      if (cancelled) return;
      const fragment = document.createDocumentFragment();
      nodes.forEach((node) => fragment.appendChild(node));
      hardenDocxOutput(fragment);
      frameDoc.body.replaceChildren(fragment);
      frameDoc.addEventListener('keydown', forwardEscape);
      target = frameDoc;
      setReady(true);
    })().catch(() => {
      if (!cancelled) onError();
    });
    return () => {
      cancelled = true;
      target?.removeEventListener('keydown', forwardEscape);
      target?.body.replaceChildren();
    };
  }, [data, onError, frame]);

  return (
    <div className="relative w-full h-full">
      <iframe
        title={t('documents:preview.title')}
        sandbox={FRAME_SANDBOX}
        srcDoc={FRAME_SRCDOC}
        onLoad={handleFrameLoad}
        className="block w-full h-full border-0 bg-[#E5E7EB]"
      />
      {!ready && <PreviewLoadingOverlay />}
    </div>
  );
}
