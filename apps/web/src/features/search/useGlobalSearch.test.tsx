// 25/07/2026: test moi cho hanh vi "hasInteracted gate `enabled`" cua useGlobalSearch (ban sua
// loi thuc te 22/07/2026 - xem chu thich tren dinh useGlobalSearch.ts). Truoc ban sua do, 4 query
// "lay toan bo 1 lan" (du an/cong viec/thanh vien/thu muc) chay VO DIEU KIEN ngay khi hook duoc
// goi, du GlobalSearchBox mount o MOI trang qua Topbar - gay ton 4 request khong can thiet tren
// moi trang. Mock apiClient.get (dung chung boi ca 4 query nguon) de dem so lan goi that su, thay
// vi mock tung hook rieng le - qua do xac nhan CA CHUOI that (hook -> useQuery -> queryFn ->
// apiClient.get) ton trong `enabled`, khong chi mock hoa gia gia dinh.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useGlobalSearch } from './useGlobalSearch';

const getMock = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: (...args: unknown[]) => getMock(...args) },
  authClient: { post: vi.fn() },
  extractErrorMessage: () => 'loi',
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useGlobalSearch - 4 query nguon chi bat khi hasInteracted=true', () => {
  beforeEach(() => {
    getMock.mockReset();
    // response.data = { data: [] } - khop dung "hinh dang" PaginatedResponse<T> ma
    // fetchAllProjects/fetchTasks/fetchAllUsers doc qua `data.data`, va unwrapList() cua
    // fetchFolders cung nhan dang duoc dang { data: [] } nay (tranh canh bao "Query data cannot
    // be undefined" tu react-query khi mock tra ve hinh dang khong khop ham fetch that).
    getMock.mockResolvedValue({ data: { data: [] } });
  });

  it('khong goi API nao khi hasInteracted=false', async () => {
    renderHook(() => useGlobalSearch('abc', false), { wrapper: createWrapper() });

    // Cho 1 nhip de chac chan khong co request nao "lot" qua (vd goi bat dong bo trong microtask).
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getMock).not.toHaveBeenCalled();
  });

  it('goi du ca 4 API nguon (du an, cong viec, thanh vien, thu muc) khi hasInteracted=true', async () => {
    renderHook(() => useGlobalSearch('abc', true), { wrapper: createWrapper() });

    await waitFor(() => expect(getMock.mock.calls.length).toBeGreaterThanOrEqual(4));

    const calledPaths = getMock.mock.calls.map((call) => call[0]);
    expect(calledPaths).toEqual(expect.arrayContaining(['/projects', '/tasks', '/users', '/folders']));
  });

  it('chuyen tu hasInteracted=false sang true (focus o tren) se kich hoat goi API', async () => {
    const { rerender } = renderHook(({ hasInteracted }) => useGlobalSearch('abc', hasInteracted), {
      wrapper: createWrapper(),
      initialProps: { hasInteracted: false },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getMock).not.toHaveBeenCalled();

    rerender({ hasInteracted: true });

    await waitFor(() => expect(getMock).toHaveBeenCalled());
  });
});
