// 27/10/2026: hop tai anh nhan dien ho - "Chup bang camera": co webcam (secure context + getUserMedia)
// thi mo CheckInCamera, khong co thi dung <input accept="image/*" capture="environment">; anh chup va
// tep chon tu may di chung 1 duong chuan hoa -> /inspect -> loi chan khoa "Gui anh" -> upload.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { FaceInspectResult } from '@/types';
import { FaceUploadDialog } from './FaceUploadDialog';

const normalize = vi.fn();
const inspect = vi.fn();
const uploadMutate = vi.fn();
const cameraProps = vi.fn();
const capturedBlob = new Blob(['webcam-frame'], { type: 'image/jpeg' });
const normalizedBlob = new Blob(['normalized'], { type: 'image/jpeg' });

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/image-normalize', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/image-normalize')>()),
  normalizeFacePhoto: (...args: unknown[]) => normalize(...args),
}));
vi.mock('../api', () => ({ inspectFacePhoto: (...args: unknown[]) => inspect(...args) }));
vi.mock('../hooks', () => ({ useUploadUserFace: () => ({ mutate: uploadMutate, isPending: false }) }));
vi.mock('@/hooks/useOrgUsers', () => ({ useUserNameMap: () => ({ map: {} }) }));
vi.mock('@/features/hrm/components/CheckInCamera', () => ({
  CheckInCamera: (props: { open: boolean; onConfirm: (photo: Blob) => void }) => {
    cameraProps(props);
    return props.open ? (
      <button type="button" onClick={() => props.onConfirm(capturedBlob)}>
        stub-camera-confirm
      </button>
    ) : null;
  },
}));

function inspectResult(partial: Partial<FaceInspectResult>): FaceInspectResult {
  return { ok: true, errorCode: null, warnings: [], faceCount: 1, faceHeight: 220, sharpness: 120, duplicateUserId: null, ...partial };
}

function setWebcam(available: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value: available, configurable: true });
  Object.defineProperty(navigator, 'mediaDevices', { value: available ? { getUserMedia: vi.fn() } : undefined, configurable: true });
}

function renderDialog() {
  return render(<FaceUploadDialog open onClose={vi.fn()} userId="u-1" userName="Nguyen Van A" />);
}

const sendButton = () => screen.getByRole('button', { name: 'admin:facePanel.send' });
const cameraButton = () => screen.getByRole('button', { name: 'admin:facePanel.capture' });

describe('FaceUploadDialog - chup bang camera', () => {
  beforeAll(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    normalize.mockResolvedValue(normalizedBlob);
  });

  afterEach(() => setWebcam(false));

  it('khong co getUserMedia (http LAN) -> render input capture="environment", nut camera mo app camera thay vi CheckInCamera', () => {
    setWebcam(false);
    renderDialog();
    const captureInput = document.querySelector('input[capture]') as HTMLInputElement;
    expect(captureInput).not.toBeNull();
    expect(captureInput.getAttribute('capture')).toBe('environment');
    expect(captureInput.getAttribute('accept')).toBe('image/*');
    const click = vi.spyOn(captureInput, 'click');
    fireEvent.click(cameraButton());
    expect(click).toHaveBeenCalled();
    expect(screen.queryByText('stub-camera-confirm')).toBeNull();
  });

  it('anh tu app camera di cung duong chuan hoa -> inspect -> upload (ban cho xac nhan)', async () => {
    setWebcam(false);
    inspect.mockResolvedValue(inspectResult({}));
    renderDialog();
    const photo = new File(['phone-photo'], 'IMG_0001.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('input[capture]') as HTMLInputElement, { target: { files: [photo] } });
    await waitFor(() => expect(sendButton()).toBeEnabled());
    expect(normalize).toHaveBeenCalledWith(photo);
    expect(inspect).toHaveBeenCalledWith(normalizedBlob, 'u-1');
    fireEvent.click(sendButton());
    expect(uploadMutate).toHaveBeenCalledWith({ userId: 'u-1', photo: normalizedBlob }, expect.anything());
  });

  it('co webcam -> khong co input capture, nut camera mo CheckInCamera (camera sau); anh chup qua /inspect, loi chan khoa Gui', async () => {
    setWebcam(true);
    inspect.mockResolvedValue(inspectResult({ ok: false, errorCode: 'FACE_NONE', faceCount: 0, faceHeight: 0 }));
    renderDialog();
    expect(document.querySelector('input[capture]')).toBeNull();
    fireEvent.click(cameraButton());
    expect(cameraProps).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, mode: 'enroll', facingMode: 'environment' }));
    fireEvent.click(screen.getByText('stub-camera-confirm'));
    await waitFor(() => expect(screen.getByText('errors:FACE_NONE')).toBeInTheDocument());
    expect(normalize).toHaveBeenCalledWith(capturedBlob);
    expect(inspect).toHaveBeenCalledWith(normalizedBlob, 'u-1');
    expect(screen.queryByText('stub-camera-confirm')).toBeNull();
    expect(sendButton()).toBeDisabled();
    expect(uploadMutate).not.toHaveBeenCalled();
  });

  // 28/10/2026: o chon anh va nut camera cung bi khoa khi anh dang /inspect - khong chon duoc anh thu 2 de
  // ket qua cua anh truoc mo khoa "Gui anh" cho anh sau.
  it('dang kiem tra anh -> khoa o chon anh va nut camera', async () => {
    setWebcam(false);
    let finish!: (r: FaceInspectResult) => void;
    inspect.mockReturnValue(new Promise<FaceInspectResult>((resolve) => (finish = resolve)));
    renderDialog();
    const fileBox = screen.getByRole('button', { name: 'admin:facePanel.chooseFile' });
    fireEvent.change(document.querySelector('input[capture]') as HTMLInputElement, { target: { files: [new File(['a'], 'a.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(fileBox).toBeDisabled());
    expect(cameraButton()).toBeDisabled();
    finish(inspectResult({}));
    await waitFor(() => expect(fileBox).toBeEnabled());
    expect(sendButton()).toBeEnabled();
  });

  // 28/10/2026: dong hop khi /inspect con dang cho -> ket qua ve sau bi bo qua, mo lai hop khong con
  // hien dong ket qua/loi cua anh cu.
  it('dong hop khi dang kiem tra anh -> mo lai khong hien ket qua cu', async () => {
    setWebcam(false);
    let finish!: (r: FaceInspectResult) => void;
    inspect.mockReturnValue(new Promise<FaceInspectResult>((resolve) => (finish = resolve)));
    const { rerender } = renderDialog();
    fireEvent.change(document.querySelector('input[capture]') as HTMLInputElement, { target: { files: [new File(['a'], 'a.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(inspect).toHaveBeenCalled());
    rerender(<FaceUploadDialog open={false} onClose={vi.fn()} userId="u-1" userName="Nguyen Van A" />);
    await act(async () => finish(inspectResult({})));
    rerender(<FaceUploadDialog open onClose={vi.fn()} userId="u-1" userName="Nguyen Van A" />);
    expect(screen.queryByText('admin:facePanel.oneFace')).toBeNull();
    expect(screen.getByText('admin:facePanel.chooseFileHint')).toBeInTheDocument();
    expect(cameraButton()).toBeEnabled();
    expect(sendButton()).toBeDisabled();
  });

  it('trinh duyet khong giai ma duoc anh (vd HEIC) -> loi FACE_INVALID_IMAGE, khong goi inspect, khong crash', async () => {
    setWebcam(false);
    const { ImageNormalizeError } = await import('@/lib/image-normalize');
    inspect.mockResolvedValue(inspectResult({ ok: false, errorCode: 'FACE_NONE', faceCount: 0, faceHeight: 0 }));
    renderDialog();
    const captureInput = document.querySelector('input[capture]') as HTMLInputElement;
    fireEvent.change(captureInput, { target: { files: [new File(['jpeg'], 'IMG_0001.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(screen.getByText('errors:FACE_NONE')).toBeInTheDocument());
    expect(document.querySelector('img')).not.toBeNull();

    normalize.mockRejectedValue(new ImageNormalizeError('decode-failed'));
    const heic = new File(['heic'], 'IMG_0002.HEIC', { type: 'image/heic' });
    fireEvent.change(captureInput, { target: { files: [heic] } });
    await waitFor(() => expect(screen.getByText('errors:FACE_INVALID_IMAGE')).toBeInTheDocument());
    expect(inspect).toHaveBeenCalledTimes(1);
    // khong con hien xem truoc anh cu canh loi cua anh moi
    expect(document.querySelector('img')).toBeNull();
    expect(sendButton()).toBeDisabled();
  });
});
