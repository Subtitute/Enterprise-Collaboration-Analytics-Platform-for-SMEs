// 27/10/2026 - Bổ sung unit test cho Việc 5.1 & 5.2
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CustomerCard, CustomerTypeBadge } from './CustomerCard';
import type { Customer } from '@/types';
import { BrowserRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (key === 'crm:newCustomerModal.customerTypes.new') return 'Mới';
      if (key === 'crm:newCustomerModal.customerTypes.loyal') return 'Thân thiết';
      if (key === 'crm:newCustomerModal.customerTypes.lead') return 'Tiềm năng';
      if (key === 'crm:newCustomerModal.customerTypes.vip') return 'VIP';
      if (key === 'crm:customerCard.lastInteractionLabel') return 'Tương tác:';
      return key;
    },
  }),
}));

vi.mock('../hooks', () => ({
  useDeleteCustomer: () => ({
    mutate: vi.fn(),
  }),
  useUpdateCustomer: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

describe('CustomerCard & CustomerTypeBadge - Khách hàng CRM', () => {
  const baseCustomer: Customer = {
    id: 'cust-1',
    name: 'Công ty Cổ phần Công nghệ ABC',
    company: 'Tập đoàn ABC',
    email: 'contact@abc.vn',
    phone: '0901234567',
    ownerUserId: 'user-1',
    notes: 'Khách hàng mới',
    openDealValue: 150000000,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z',
  };

  it('1. CustomerTypeBadge: ánh xạ đúng loại "Mới" khi notes chứa "mới"', () => {
    render(<CustomerTypeBadge notes="Khách hàng mới" />);
    expect(screen.getByText('Mới')).toBeInTheDocument();
  });

  it('2. CustomerTypeBadge: ánh xạ đúng loại "Thân thiết" khi notes chứa "thân thiết"', () => {
    render(<CustomerTypeBadge notes="Đối tác thân thiết" />);
    expect(screen.getByText('Thân thiết')).toBeInTheDocument();
  });

  it('3. CustomerTypeBadge: ánh xạ đúng loại "Tiềm năng" khi notes chứa "lead"', () => {
    render(<CustomerTypeBadge notes="Hot lead tháng 10" />);
    expect(screen.getByText('Tiềm năng')).toBeInTheDocument();
  });

  it('4. CustomerTypeBadge: không hiển thị khi notes là null hoặc undefined', () => {
    const { container } = render(<CustomerTypeBadge notes={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('5. CustomerCard: render đầy đủ tên khách hàng, công ty và email', () => {
    render(
      <BrowserRouter>
        <CustomerCard customer={baseCustomer} />
      </BrowserRouter>,
    );

    expect(screen.getByText('Công ty Cổ phần Công nghệ ABC')).toBeInTheDocument();
    expect(screen.getByText('Tập đoàn ABC')).toBeInTheDocument();
    expect(screen.getByText('contact@abc.vn')).toBeInTheDocument();
  });

  it('6. CustomerCard: hiển thị đúng định dạng giá trị deal khi > 0 và khi = 0', () => {
    const { rerender } = render(
      <BrowserRouter>
        <CustomerCard customer={baseCustomer} />
      </BrowserRouter>,
    );
    expect(screen.getByText(/150\.000\.000/)).toBeInTheDocument();

    const zeroDealCustomer: Customer = {
      ...baseCustomer,
      id: 'cust-2',
      openDealValue: 0,
    };

    rerender(
      <BrowserRouter>
        <CustomerCard customer={zeroDealCustomer} />
      </BrowserRouter>,
    );
    expect(screen.getByText(/0 VND/)).toBeInTheDocument();
  });
});
