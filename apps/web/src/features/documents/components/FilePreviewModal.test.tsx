// 27/10/2026: test tich hop FilePreviewModal cho 3 loai Office (chunk lazy that, fetch gia lap tra ve
// tep tao trong bo nho) + giu nguyen hanh vi cu cua tep vuot nguong dung luong.
// 28/10/2026: chuoi giao dien lay qua i18n.t (khong assert chuoi tieng Viet viet tay); them test iframe
// sandbox cua .docx va test spinner ket sau khi dong modal giua luc dang tai.
import { render, screen, waitFor } from '@testing-library/react';
import { strToU8, zipSync } from 'fflate';
import * as XLSX from 'xlsx';
import i18n from '@/i18n';
import { FilePreviewModal } from './FilePreviewModal';
import type { FileItem } from '@/types';

vi.mock('../api', () => ({ getDownloadUrl: vi.fn(async () => 'http://minio.test/presigned') }));

const P_NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

function makeFile(name: string, size = 1000): FileItem {
  return { id: `id-${name}`, name, folderId: null, size, createdAt: '', updatedAt: '' };
}

function mockFetch(body: Uint8Array | string) {
  const fetchMock = vi.fn(async () => new Response(body as BodyInit));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function minimalDocx(): Uint8Array {
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';
  return zipSync({
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    '_rels/.rels': strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}" Target="word/document.xml"/></Relationships>`,
    ),
    'word/document.xml': strToU8(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Xin chào</w:t></w:r></w:p></w:body></w:document>',
    ),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FilePreviewModal - Office preview', () => {
  it('renders a simplified slide-by-slide view for .pptx', async () => {
    const slide = `<p:sld ${P_NS}><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Kế hoạch ra mắt</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
    mockFetch(zipSync({ 'ppt/presentation.xml': strToU8(`<p:presentation ${P_NS}/>`), 'ppt/slides/slide1.xml': strToU8(slide) }));

    render(<FilePreviewModal file={makeFile('deck.pptx')} open onClose={vi.fn()} onDownload={vi.fn()} />);

    expect(await screen.findByText('Kế hoạch ra mắt', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('documents:preview.slideLabel', { n: 1 }))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('documents:preview.pptxSimplified'))).toBeInTheDocument();
  });

  it('renders sheet tabs and a value table for .xlsx', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Thiết bị', 'Số lượng'], ['Máy chủ', 4]]), 'Kiểm kê');
    mockFetch(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer));

    render(<FilePreviewModal file={makeFile('kiem-ke.xlsx')} open onClose={vi.fn()} onDownload={vi.fn()} />);

    expect(await screen.findByText('Máy chủ', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Kiểm kê' })).toBeInTheDocument();
    expect(screen.getByText('Số lượng')).toBeInTheDocument();
  });

  it('shows the existing error UI for a corrupt .docx', async () => {
    mockFetch('this is not a zip');

    render(<FilePreviewModal file={makeFile('hong.docx')} open onClose={vi.fn()} onDownload={vi.fn()} />);

    expect(await screen.findByText(i18n.t('documents:preview.loadErrorTitle'), {}, { timeout: 5000 })).toBeInTheDocument();
  });

  // 28/10/2026: .xlsx rong/doi duoi hien cung giao dien loi nhu .docx/.pptx (truoc day: bang Sheet1 trong).
  it.each([
    ['empty', new Uint8Array(0)],
    ['renamed HTML', strToU8('<html><body><table><tr><td>cell</td></tr></table></body></html>')],
  ])('shows the existing error UI for an %s .xlsx', async (_label, body) => {
    mockFetch(body);

    render(<FilePreviewModal file={makeFile('trong.xlsx')} open onClose={vi.fn()} onDownload={vi.fn()} />);

    expect(await screen.findByText(i18n.t('documents:preview.loadErrorTitle'), {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('renders .docx inside a script-less sandboxed iframe with its own CSP', async () => {
    mockFetch(minimalDocx());

    render(<FilePreviewModal file={makeFile('noi-quy.docx')} open onClose={vi.fn()} onDownload={vi.fn()} />);

    const frame = await screen.findByTitle(i18n.t('documents:preview.title'), {}, { timeout: 5000 });
    const sandbox = frame.getAttribute('sandbox') ?? '';
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.hasAttribute('sandbox')).toBe(true);
    expect(sandbox).not.toContain('allow-scripts');
    expect(frame.getAttribute('srcdoc')).toContain("default-src 'none'");
  });

  it('does not download Office files above 15MB', async () => {
    const fetchMock = mockFetch('unused');

    render(<FilePreviewModal file={makeFile('lon.pptx', 16 * 1024 * 1024)} open onClose={vi.fn()} onDownload={vi.fn()} />);

    expect(await screen.findByText(/> 15MB/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts a pending download on close and does not leave the next file stuck on the spinner', async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      }),
    );
    const docx = makeFile('dang-tai.docx');
    const pdf = makeFile('bao-cao.pdf');
    const { rerender } = render(<FilePreviewModal file={docx} open onClose={vi.fn()} onDownload={vi.fn()} />);
    await waitFor(() => expect(signal).toBeDefined());

    rerender(<FilePreviewModal file={docx} open={false} onClose={vi.fn()} onDownload={vi.fn()} />);
    expect(signal?.aborted).toBe(true);

    rerender(<FilePreviewModal file={pdf} open onClose={vi.fn()} onDownload={vi.fn()} />);
    expect(await screen.findByTitle('bao-cao.pdf')).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('documents:preview.loading'))).not.toBeInTheDocument();
  });
});
