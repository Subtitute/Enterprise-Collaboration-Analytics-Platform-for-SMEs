// 27/10/2026: CheckInCamera them 2 prop tuy chon (facingMode, confirmLabel) cho hop tai anh nhan dien
// ho - test giu hanh vi cu cua cham cong (camera truoc, nhan mac dinh) va kiem tra 2 prop moi.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CheckInCamera } from './CheckInCamera';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const frame = new Blob(['frame'], { type: 'image/jpeg' });
const getUserMedia = vi.fn();

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = function toBlob(cb: BlobCallback) {
    cb(frame);
  };
});

beforeEach(() => {
  getUserMedia.mockReset();
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
});

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
});

async function captureFrame(captureKey: string) {
  const capture = screen.getByRole('button', { name: captureKey });
  await waitFor(() => expect(capture).toBeEnabled());
  fireEvent.click(capture);
}

describe('CheckInCamera', () => {
  it('mac dinh (cham cong): camera truoc, nut xac nhan theo mode, tra anh chup cho onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<CheckInCamera open onClose={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByText('hrm:checkInCamera.modalTitle')).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'user' } });
    await captureFrame('hrm:checkInCamera.captureButton');
    fireEvent.click(screen.getByRole('button', { name: 'hrm:checkInCamera.confirmButton' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(frame, undefined));
  });

  it('facingMode + confirmLabel tuy chon (tai anh ho): camera sau, nhan nut xac nhan rieng', async () => {
    const onConfirm = vi.fn();
    render(<CheckInCamera open onClose={vi.fn()} onConfirm={onConfirm} mode="enroll" facingMode="environment" confirmLabel="use-this-photo" />);
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment' } });
    await captureFrame('hrm:faceEnroll.captureButton');
    fireEvent.click(screen.getByRole('button', { name: 'use-this-photo' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(frame, undefined));
  });

  it('khong co navigator.mediaDevices -> bao khong ho tro (hanh vi cu giu nguyen)', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    render(<CheckInCamera open onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(await screen.findByText('hrm:checkInCamera.cameraUnavailable')).toBeInTheDocument();
  });

  // 28/10/2026: dong roi mo lai TRUOC KHI lan xin camera dau tien resolve -> stream cua lan cu phai bi
  // stop (truoc day bi ghi de, den camera sang mai); go component khi dang hien anh chup -> thu hoi URL.
  it('dong/mo lai khi camera chua san sang -> stream cua lan cu bi dung, chi lan moi nhat duoc dung', async () => {
    const pending = () => {
      const track = { stop: vi.fn() };
      let resolve: () => void = () => undefined;
      const promise = new Promise((done) => {
        resolve = () => done({ getTracks: () => [track] });
      });
      return { track, promise, resolve };
    };
    const first = pending();
    const second = pending();
    getUserMedia.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const props = { onClose: vi.fn(), onConfirm: vi.fn() };
    const { rerender, unmount } = render(<CheckInCamera open {...props} />);
    rerender(<CheckInCamera open={false} {...props} />);
    rerender(<CheckInCamera open {...props} />);
    await act(async () => {
      first.resolve();
      second.resolve();
    });
    expect(first.track.stop).toHaveBeenCalled();
    expect(second.track.stop).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'hrm:checkInCamera.captureButton' })).toBeEnabled());
    unmount();
    expect(second.track.stop).toHaveBeenCalled();
  });

  it('go component khi dang hien anh vua chup -> thu hoi Object URL cua anh xem truoc', async () => {
    const { unmount } = render(<CheckInCamera open onClose={vi.fn()} onConfirm={vi.fn()} mode="enroll" />);
    await captureFrame('hrm:faceEnroll.captureButton');
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:preview');
    vi.mocked(URL.revokeObjectURL).mockClear();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });
});
