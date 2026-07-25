// 25/07/2026: test moi cho hanh vi "cuon BEN TRONG panel khong duoc lam dong Dropdown" (ban sua
// loi thuc te 22/07/2026 - xem chu thich onScroll trong Dropdown.tsx). Truoc ban sua do, moi su
// kien scroll BAT KY dau trong document (ke ca cuon ben trong chinh panel dang mo, vd danh sach
// thong bao dai) deu lam Dropdown tu dong dong lai. Test nay dung fireEvent.scroll(...) tren 1
// node BEN TRONG panel (phai KHONG dong) va tren document.body - ngoai panel (phai dong).
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dropdown } from './Dropdown';

function renderDropdown() {
  render(
    <Dropdown trigger={({ toggle }) => <button onClick={toggle}>Mở menu</button>}>
      {() => (
        <div data-testid="panel-content" style={{ maxHeight: 100, overflowY: 'auto' }}>
          Nội dung menu
        </div>
      )}
    </Dropdown>,
  );
}

describe('Dropdown - dong khi cuon ngoai panel, khong dong khi cuon trong panel', () => {
  it('scroll voi target ben trong panel KHONG dong menu', () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Mở menu'));
    const panel = screen.getByTestId('panel-content');

    fireEvent.scroll(panel);

    expect(screen.getByTestId('panel-content')).toBeInTheDocument();
  });

  it('scroll voi target ben ngoai panel se dong menu', () => {
    renderDropdown();
    fireEvent.click(screen.getByText('Mở menu'));
    expect(screen.getByTestId('panel-content')).toBeInTheDocument();

    fireEvent.scroll(document.body);

    expect(screen.queryByTestId('panel-content')).not.toBeInTheDocument();
  });
});
