// 28/10/2026: Modal chong Modal (vd ho so nhan vien -> hop tai anh nhan dien -> camera) - phim Escape chi
// dong lop tren cung; truoc day 1 lan Escape dong tat ca cac lop dang mo cung luc. Cac lop duoc mo lan
// luot (moi lop 1 lan render) giong cach nguoi dung mo trong ung dung.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { Modal } from './Modal';

interface StackProps {
  depth: 0 | 1 | 2 | 3;
  onClose: [() => void, () => void, () => void];
  topPending?: boolean;
}

function Stack({ depth, onClose, topPending = false }: StackProps) {
  return (
    <Modal open={depth >= 1} onClose={onClose[0]} title="drawer">
      <p>drawer-body</p>
      <Modal open={depth >= 2} onClose={onClose[1]} title="dialog" preventCloseWhilePending={depth === 2 && topPending}>
        <p>dialog-body</p>
        <Modal open={depth >= 3} onClose={onClose[2]} title="camera" preventCloseWhilePending={depth === 3 && topPending}>
          <p>camera-body</p>
        </Modal>
      </Modal>
    </Modal>
  );
}

const pressEscape = () => fireEvent.keyDown(document, { key: 'Escape' });

function openStack(onClose: StackProps['onClose'], topPending = false) {
  const view = render(<Stack depth={1} onClose={onClose} />);
  view.rerender(<Stack depth={2} onClose={onClose} />);
  view.rerender(<Stack depth={3} onClose={onClose} topPending={topPending} />);
  return view;
}

describe('Modal - Escape voi nhieu lop modal', () => {
  it('chi dong lop tren cung, lop duoi nhan Escape sau khi lop tren da dong', () => {
    const onClose: StackProps['onClose'] = [vi.fn(), vi.fn(), vi.fn()];
    const { rerender } = openStack(onClose);

    pressEscape();
    expect(onClose[2]).toHaveBeenCalledTimes(1);
    expect(onClose[1]).not.toHaveBeenCalled();
    expect(onClose[0]).not.toHaveBeenCalled();

    rerender(<Stack depth={2} onClose={onClose} />);
    pressEscape();
    expect(onClose[1]).toHaveBeenCalledTimes(1);
    expect(onClose[0]).not.toHaveBeenCalled();

    rerender(<Stack depth={1} onClose={onClose} />);
    pressEscape();
    expect(onClose[0]).toHaveBeenCalledTimes(1);
  });

  it('lop tren dang chan dong (preventCloseWhilePending) -> Escape khong dong lop nao', () => {
    const onClose: StackProps['onClose'] = [vi.fn(), vi.fn(), vi.fn()];
    openStack(onClose, true);
    pressEscape();
    onClose.forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it('lop duoi dong truoc (khong theo thu tu) -> lop con lai van nhan Escape', () => {
    const first = vi.fn();
    const second = vi.fn();
    const pair = (firstOpen: boolean, secondOpen: boolean) => (
      <>
        <Modal open={firstOpen} onClose={first} title="first">
          <p>first-body</p>
        </Modal>
        <Modal open={secondOpen} onClose={second} title="second">
          <p>second-body</p>
        </Modal>
      </>
    );
    const { rerender } = render(pair(true, false));
    rerender(pair(true, true));
    rerender(pair(false, true));
    pressEscape();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('1 modal duy nhat van dong bang Escape nhu cu', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="single">
        <p>body</p>
      </Modal>,
    );
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
