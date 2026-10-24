// 24/10/2026: test nut chat noi + panel Chat bot noi bo - an/hien theo quyen chatbot:use, mo/dong panel,
// Esc dong panel, va bao dung "lop noi" cho ToastContainer (ui.store chatbotLayer) de toast khong de len.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useUIStore } from '@/stores/ui.store';

const { permissionsMock } = vi.hoisted(() => ({ permissionsMock: vi.fn((): string[] => []) }));

vi.mock('@/stores/auth.store', () => ({ usePermissions: () => permissionsMock() }));
// Panel that (api/react-query) da co test rieng o tang backend - o day chi can 1 noi dung gia de kiem
// chung phan khung: vi tri, mo/dong, Esc.
vi.mock('./components/ChatbotPanel', () => ({
  ChatbotPanel: ({ open }: { open: boolean }) => (
    <div data-testid="panel-content">
      <input aria-label="panel-input" data-open={String(open)} />
    </div>
  ),
}));

import { ChatbotWidget } from './ChatbotWidget';

describe('ChatbotWidget', () => {
  beforeEach(() => {
    permissionsMock.mockReturnValue([]);
    useUIStore.setState({ chatbotLayer: 'none' });
  });

  it('khong co quyen chatbot:use -> khong render gi, khong chiem lop noi nao', () => {
    const { container } = render(<ChatbotWidget />);
    expect(container).toBeEmptyDOMElement();
    expect(useUIStore.getState().chatbotLayer).toBe('none');
  });

  it('co quyen -> hien nut chat; bam de mo/dong panel, cap nhat chatbotLayer cho Toast', async () => {
    permissionsMock.mockReturnValue(['chatbot:use']);
    render(<ChatbotWidget />);

    const launcher = screen.getByRole('button', { name: 'Mở Trợ lý ECAP' });
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    expect(useUIStore.getState().chatbotLayer).toBe('launcher');

    fireEvent.click(launcher);
    expect(await screen.findByTestId('panel-content')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Trợ lý ECAP' })).not.toHaveClass('hidden');
    expect(launcher).toHaveAttribute('aria-expanded', 'true');
    expect(launcher).toHaveAccessibleName('Đóng Trợ lý ECAP');
    expect(useUIStore.getState().chatbotLayer).toBe('panel');

    // Dong lai: panel CHI bi an (giu nguyen hoi thoai dang mo), khong bi go khoi DOM.
    fireEvent.click(launcher);
    expect(screen.getByRole('dialog', { hidden: true })).toHaveClass('hidden');
    expect(useUIStore.getState().chatbotLayer).toBe('launcher');
  });

  it('Esc ben trong panel dong panel va tra focus ve nut chat', async () => {
    permissionsMock.mockReturnValue(['chatbot:use']);
    render(<ChatbotWidget />);
    const launcher = screen.getByRole('button', { name: 'Mở Trợ lý ECAP' });
    fireEvent.click(launcher);

    fireEvent.keyDown(await screen.findByLabelText('panel-input'), { key: 'Escape' });

    expect(screen.getByRole('dialog', { hidden: true })).toHaveClass('hidden');
    expect(launcher).toHaveFocus();
  });

  it('panel focus duoc (tabIndex -1): Esc khi focus nam tren chinh panel (bam vao vung trong) van dong panel', async () => {
    permissionsMock.mockReturnValue(['chatbot:use']);
    render(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở Trợ lý ECAP' }));
    await screen.findByTestId('panel-content');
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.getByRole('dialog', { hidden: true })).toHaveClass('hidden');
  });

  it('nut chat va panel nam duoi Topbar (z-30) va moi modal/popover - z-[25]', async () => {
    permissionsMock.mockReturnValue(['chatbot:use']);
    render(<ChatbotWidget />);
    const launcher = screen.getByRole('button', { name: 'Mở Trợ lý ECAP' });
    fireEvent.click(launcher);
    await screen.findByTestId('panel-content');
    expect(launcher).toHaveClass('z-[25]');
    expect(screen.getByRole('dialog')).toHaveClass('z-[25]');
  });
});
