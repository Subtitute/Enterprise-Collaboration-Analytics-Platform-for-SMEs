// 27/10/2026: useFilePreview - mo xem truoc theo fileId (chip nguon Chat bot): bam lien 2 tep chi lay
// ket qua cua lan bam CUOI; dong modal xoa tep dang xem.
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { FileItem } from '@/types';

const mocks = vi.hoisted(() => ({ fetchFile: vi.fn() }));

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  fetchFile: mocks.fetchFile,
}));

import { useFilePreview } from './hooks';

function meta(id: string, name: string): FileItem {
  return { id, name, folderId: null, createdAt: '2026-10-27T01:00:00Z', updatedAt: '2026-10-27T01:00:00Z' };
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('useFilePreview', () => {
  beforeEach(() => mocks.fetchFile.mockReset());

  it('bam lien 2 tep: chi mo tep cua lan bam cuoi, dong modal thi xoa tep', async () => {
    let resolveSlow: (value: FileItem) => void = () => undefined;
    mocks.fetchFile.mockImplementation((id: string) =>
      id === 'slow' ? new Promise<FileItem>((resolve) => (resolveSlow = resolve)) : Promise.resolve(meta('fast', 'b.docx')),
    );
    const { result } = renderHook(() => useFilePreview(), { wrapper });

    act(() => {
      void result.current.openPreviewById('slow');
    });
    expect(result.current.loadingFileId).toBe('slow');
    await act(async () => result.current.openPreviewById('fast'));
    await act(async () => resolveSlow(meta('slow', 'a.txt')));

    await waitFor(() => expect(result.current.modalProps.file?.id).toBe('fast'));
    expect(result.current.modalProps.open).toBe(true);
    expect(result.current.loadingFileId).toBeNull();

    act(() => result.current.modalProps.onClose());
    expect(result.current.modalProps.open).toBe(false);
    expect(result.current.modalProps.file).toBeNull();
  });

  it('openPreview(file) mo ngay, khong goi API', () => {
    const { result } = renderHook(() => useFilePreview(), { wrapper });

    act(() => result.current.openPreview(meta('f-1', 'c.pdf')));

    expect(result.current.modalProps.file?.name).toBe('c.pdf');
    expect(mocks.fetchFile).not.toHaveBeenCalled();
  });
});
