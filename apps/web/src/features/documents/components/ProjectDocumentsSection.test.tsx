// 27/10/2026: muc "Tai lieu" cua trang chi tiet du an - bam ten tep mo FilePreviewModal (useFilePreview
// that, chi mock lop api), khong mo tab moi; nut tai xuong trong modal van tai attachment.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { FileItem } from '@/types';

const mocks = vi.hoisted(() => ({ fetchProjectFiles: vi.fn(), getDownloadUrl: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  fetchProjectFiles: mocks.fetchProjectFiles,
  getDownloadUrl: mocks.getDownloadUrl,
}));
// Modal xem truoc thay bang ban rut gon (noi dung modal khong thuoc pham vi test nay).
vi.mock('./FilePreviewModal', () => ({
  FilePreviewModal: ({ file, open, onDownload }: { file: FileItem | null; open: boolean; onDownload: (id: string) => void }) =>
    open && file ? (
      <div role="dialog" aria-label={file.name}>
        <button type="button" onClick={() => onDownload(file.id)}>
          modal-download
        </button>
      </div>
    ) : null,
}));

import { ProjectDocumentsSection } from './ProjectDocumentsSection';

const pdf: FileItem = {
  id: 'f-pdf',
  name: 'ke-hoach.pdf',
  folderId: 'fo-1',
  size: 4096,
  mimeType: 'application/pdf',
  createdAt: '2026-10-27T01:00:00Z',
  updatedAt: '2026-10-27T01:00:00Z',
};

function renderSection() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ProjectDocumentsSection projectId="p-1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProjectDocumentsSection', () => {
  beforeEach(() => {
    mocks.fetchProjectFiles.mockReset().mockResolvedValue([pdf]);
    mocks.getDownloadUrl.mockReset().mockResolvedValue('http://localhost:9010/signed');
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bam ten tep mo modal xem truoc, khong mo tab moi', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'ke-hoach.pdf' }));

    expect(screen.getByRole('dialog', { name: 'ke-hoach.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ke-hoach.pdf' })).toHaveAttribute('title', 'documents:fileTable.openFileTitle');
    expect(openSpy).not.toHaveBeenCalled();
    expect(mocks.getDownloadUrl).not.toHaveBeenCalled();
  });

  it('nut tai xuong trong modal tai attachment', async () => {
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'ke-hoach.pdf' }));
    fireEvent.click(screen.getByRole('button', { name: 'modal-download' }));

    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    await waitFor(() => expect(tab.location.href).toBe('http://localhost:9010/signed'));
    expect(mocks.getDownloadUrl).toHaveBeenCalledWith('f-pdf', 'attachment');
  });
});
