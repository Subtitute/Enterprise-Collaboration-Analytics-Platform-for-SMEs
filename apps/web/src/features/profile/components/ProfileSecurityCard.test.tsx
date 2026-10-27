// 26/10/2026: nut "Cap nhat mat khau" goi API that (PATCH /users/me/password) roi dang xuat - truoc day
// chi setTimeout + toast thanh cong gia lap (phat hien qua kiem thu A4).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileSecurityCard } from './ProfileSecurityCard';

const changeMyPassword = vi.fn();
const logout = vi.fn();
vi.mock('../api', () => ({ changeMyPassword: (...args: unknown[]) => changeMyPassword(...args) }));
vi.mock('@/features/auth/hooks', () => ({ useLogout: () => ({ mutate: logout }) }));

function renderCard() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ProfileSecurityCard />
    </QueryClientProvider>,
  );
  fireEvent.change(document.getElementById('current-password') as HTMLInputElement, { target: { value: 'MatKhauCu123!' } });
  fireEvent.change(document.getElementById('new-password') as HTMLInputElement, { target: { value: 'MatKhauMoi456!' } });
}

describe('ProfileSecurityCard', () => {
  beforeEach(() => {
    changeMyPassword.mockReset();
    logout.mockReset();
  });

  it('goi PATCH /users/me/password voi mat khau hien tai + moi, thanh cong thi dang xuat', async () => {
    changeMyPassword.mockResolvedValue(undefined);
    renderCard();
    fireEvent.change(document.getElementById('confirm-password') as HTMLInputElement, { target: { value: 'MatKhauMoi456!' } });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(changeMyPassword).toHaveBeenCalledWith('MatKhauCu123!', 'MatKhauMoi456!');
  });

  it('xac nhan khong khop -> khong goi API', async () => {
    renderCard();
    fireEvent.change(document.getElementById('confirm-password') as HTMLInputElement, { target: { value: 'khac' } });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await new Promise((r) => setTimeout(r, 20));
    expect(changeMyPassword).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });
});
