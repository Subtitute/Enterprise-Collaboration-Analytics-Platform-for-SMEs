// 24/10/2026 (ra soat cuoi): vi tri cum toast khi panel Chat bot dang mo - man hinh < 640px phai nam o
// mep TREN (panel chiem tu 4.5rem toi 10rem tinh tu day), sm+ nam ben trai panel.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastContainer } from './Toast';
import { useToastStore } from '@/stores/toast.store';
import { useUIStore } from '@/stores/ui.store';

describe('ToastContainer - vi tri theo lop noi Chat bot', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [{ id: 't1', variant: 'success', title: 'Da luu' }] } as never);
  });

  it('panel dang mo: mobile o mep tren (khong con bottom-40 de len panel), sm+ ben trai panel', () => {
    useUIStore.setState({ chatbotLayer: 'panel' });
    render(<ToastContainer />);
    const container = screen.getByRole('status').parentElement as HTMLElement;
    expect(container).toHaveClass('top-2', 'sm:top-auto', 'sm:bottom-20', 'sm:right-[26rem]');
    expect(container).not.toHaveClass('bottom-40');
  });

  it('chi co nut chat: day toast len tren nut chat', () => {
    useUIStore.setState({ chatbotLayer: 'launcher' });
    render(<ToastContainer />);
    expect(screen.getByRole('status').parentElement).toHaveClass('bottom-40', 'sm:bottom-20');
  });
});
