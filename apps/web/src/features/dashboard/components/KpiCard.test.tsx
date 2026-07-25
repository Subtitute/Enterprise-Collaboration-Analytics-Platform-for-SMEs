// 25/07/2026: test moi cho trang thai isError/onRetry cua KpiCard (ban sua loi thuc te 22/07/2026
// - xem chu thich prop isError trong KpiCard.tsx). Truoc ban sua do, KpiCard chi nhan isLoading,
// khi query nguon loi thi the hien '—' MAI MAI khong khac gi "chua co du lieu", khong co nut thu lai.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KpiCard } from './KpiCard';

describe('KpiCard', () => {
  it('hien gia tri binh thuong khi khong loi/khong tai', () => {
    render(<KpiCard label="Tổng công việc" value={42} icon={<span />} />);
    expect(screen.getByText('Tổng công việc')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('hien trang thai loi thay vi gia tri khi isError=true, va an hint', () => {
    render(<KpiCard label="Tổng công việc" value={42} hint="gợi ý" icon={<span />} isError />);
    expect(screen.getByText('Lỗi tải dữ liệu')).toBeInTheDocument();
    expect(screen.queryByText('42')).not.toBeInTheDocument();
    expect(screen.queryByText('gợi ý')).not.toBeInTheDocument();
  });

  it('bam nut thu lai se goi onRetry', () => {
    const onRetry = vi.fn();
    render(<KpiCard label="Tổng công việc" value={42} icon={<span />} isError onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại tải Tổng công việc' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('khong hien nut thu lai neu khong truyen onRetry', () => {
    render(<KpiCard label="Tổng công việc" value={42} icon={<span />} isError />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
