// 27/10/2026: bam ten tep (bang lan luoi) va "Xem tệp" trong menu deu mo xem truoc (onPreview ->
// FilePreviewModal), KHONG mo tab moi; nut/muc "Tải xuống" van tai xuong attachment nhu cu.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { FileItem } from '@/types';

const mocks = vi.hoisted(() => ({ openFile: vi.fn(), deleteMutate: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../hooks', () => ({
  useDownloadFile: () => ({ openFile: mocks.openFile }),
  useDeleteFile: () => ({ mutate: mocks.deleteMutate }),
}));

import { FileTable } from './FileTable';

const files: FileItem[] = [
  { id: 'f-txt', name: 'ghi-chu.txt', folderId: 'fo-1', size: 12, mimeType: 'text/plain', version: 1, createdAt: '2026-10-27T01:00:00Z', updatedAt: '2026-10-27T01:00:00Z' },
  {
    id: 'f-docx',
    name: 'noi-quy.docx',
    folderId: 'fo-1',
    size: 2048,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    version: 2,
    createdAt: '2026-10-27T01:00:00Z',
    updatedAt: '2026-10-27T01:00:00Z',
  },
];

function renderTable(viewMode: 'grid' | 'list') {
  const onPreview = vi.fn();
  render(<FileTable files={files} folderId="fo-1" onShare={vi.fn()} onVersionHistory={vi.fn()} onPreview={onPreview} viewMode={viewMode} />);
  return { onPreview };
}

describe('FileTable - mo tep', () => {
  beforeEach(() => {
    mocks.openFile.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['list', 'grid'] as const)('che do %s: bam ten tep mo xem truoc, khong mo tab/tai xuong', (viewMode) => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const { onPreview } = renderTable(viewMode);

    fireEvent.click(screen.getByRole('button', { name: /noi-quy\.docx/ }));

    expect(onPreview).toHaveBeenCalledWith(files[1]);
    expect(mocks.openFile).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('nut tai xuong canh ten tep van tai attachment', () => {
    const { onPreview } = renderTable('list');

    fireEvent.click(screen.getAllByTitle('documents:fileTable.download')[0]);

    expect(mocks.openFile).toHaveBeenCalledWith('f-txt');
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('menu: "Xem tệp" mo xem truoc, "Tải xuống" tai attachment', () => {
    const { onPreview } = renderTable('list');

    fireEvent.click(screen.getAllByRole('button', { name: 'documents:fileTable.optionsAria' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'documents:fileTable.viewFile' }));
    expect(onPreview).toHaveBeenCalledWith(files[0]);

    fireEvent.click(screen.getAllByRole('button', { name: 'documents:fileTable.optionsAria' })[0]);
    // Nut tai xuong o hang (title) va muc menu cung ten - muc menu la phan tu sau cung.
    const downloadButtons = screen.getAllByRole('button', { name: 'documents:fileTable.download' });
    fireEvent.click(downloadButtons[downloadButtons.length - 1]);
    expect(mocks.openFile).toHaveBeenCalledWith('f-txt');
  });
});
