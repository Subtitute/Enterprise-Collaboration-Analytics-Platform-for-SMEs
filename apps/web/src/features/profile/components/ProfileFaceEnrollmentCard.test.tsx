// 27/10/2026: tu dang ky khuon mat - trinh duyet khong co webcam (dien thoai vao qua http LAN) thi nut
// camera mo app camera qua <input accept="image/*" capture="user"> (anh chuan hoa nhu "Tai anh tu may",
// nguon SELF_CAMERA); co webcam thi van mo CheckInCamera nhu cu.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ProfileFaceEnrollmentCard } from './ProfileFaceEnrollmentCard';

const normalize = vi.fn();
const enrollMutate = vi.fn();
const cameraProps = vi.fn();
// 28/10/2026: CheckInCamera thu 2 cua nut "Thu nhan dien" (co `title` rieng) - ghi rieng de khong lam lech
// cac assertion toHaveBeenLastCalledWith cua camera dang ky.
const testCameraProps = vi.fn();
const faceTestMutate = vi.fn();
const statusState = { status: 'NONE' };
const toastError = vi.fn();
const normalizedBlob = new Blob(['normalized'], { type: 'image/jpeg' });
// 28/10/2026: trang thai mutation dang ky doi duoc theo tung test (kiem tra spinner dung nut).
const enrollState: { isPending: boolean; variables?: { source: 'SELF_CAMERA' | 'SELF_UPLOAD' } } = { isPending: false };

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ hash: '' }) }));
vi.mock('@/lib/image-normalize', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/image-normalize')>()),
  normalizeFacePhoto: (...args: unknown[]) => normalize(...args),
}));
vi.mock('@/stores/toast.store', () => ({ toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/hooks/useOrgUsers', () => ({ useUserNameMap: () => ({ map: {} }) }));
vi.mock('@/features/face/api', () => ({ fetchMyFacePhoto: vi.fn() }));
vi.mock('@/features/face/hooks', () => {
  const idle = () => ({ mutate: vi.fn(), isPending: false });
  return {
    useMyFaceStatusQuery: () => ({
      isLoading: false,
      isError: false,
      data: { status: statusState.status, enrolled: statusState.status === 'ACTIVE', enrolledAt: null, source: null, enrolledBy: null, hasPhoto: false, pending: null, consentAction: null, consentAt: null },
    }),
    useEnrollMyFace: () => ({ mutate: enrollMutate, ...enrollState }),
    useConfirmMyPendingFace: idle,
    useRejectMyPendingFace: idle,
    useWithdrawMyFace: idle,
    useFacePhotoUrl: () => ({ url: null, failed: false }),
  };
});
vi.mock('@/features/face/components/FaceConsentDialog', () => ({
  FaceConsentDialog: ({ open, onAgree }: { open: boolean; onAgree: () => void }) =>
    open ? (
      <button type="button" onClick={onAgree}>
        stub-consent-agree
      </button>
    ) : null,
}));
vi.mock('@/features/hrm/components/CheckInCamera', () => ({
  CheckInCamera: (props: { open: boolean; title?: string }) => {
    (props.title ? testCameraProps : cameraProps)(props);
    return null;
  },
}));
vi.mock('@/features/hrm/hooks', () => ({ useFaceVerifyTest: () => ({ mutate: faceTestMutate, isPending: false }) }));

function setWebcam(available: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value: available, configurable: true });
  Object.defineProperty(navigator, 'mediaDevices', { value: available ? { getUserMedia: vi.fn() } : undefined, configurable: true });
}

function openCameraThroughConsent() {
  fireEvent.click(screen.getByRole('button', { name: 'hrm:faceEnroll.cameraButton' }));
  fireEvent.click(screen.getByText('stub-consent-agree'));
}

describe('ProfileFaceEnrollmentCard - camera fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    normalize.mockResolvedValue(normalizedBlob);
    enrollState.isPending = false;
    enrollState.variables = undefined;
    statusState.status = 'NONE';
  });

  afterEach(() => setWebcam(false));

  it('khong co getUserMedia -> nut camera (sau dong y) mo input capture="user", khong mo CheckInCamera', () => {
    setWebcam(false);
    render(<ProfileFaceEnrollmentCard />);
    const captureInput = document.querySelector('input[capture]') as HTMLInputElement;
    expect(captureInput.getAttribute('capture')).toBe('user');
    expect(captureInput.getAttribute('accept')).toBe('image/*');
    const click = vi.spyOn(captureInput, 'click');
    openCameraThroughConsent();
    expect(click).toHaveBeenCalled();
    expect(cameraProps).not.toHaveBeenCalledWith(expect.objectContaining({ open: true }));
  });

  it('anh tu app camera -> chuan hoa JPEG roi dang ky voi nguon SELF_CAMERA', async () => {
    setWebcam(false);
    render(<ProfileFaceEnrollmentCard />);
    const photo = new File(['phone-selfie'], 'IMG_0003.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('input[capture]') as HTMLInputElement, { target: { files: [photo] } });
    await waitFor(() => expect(enrollMutate).toHaveBeenCalledWith({ photo: normalizedBlob, source: 'SELF_CAMERA' }));
    expect(normalize).toHaveBeenCalledWith(photo);
  });

  it('anh khong giai ma duoc -> toast FACE_INVALID_IMAGE, khong goi dang ky', async () => {
    setWebcam(false);
    const { ImageNormalizeError } = await import('@/lib/image-normalize');
    normalize.mockRejectedValue(new ImageNormalizeError('decode-failed'));
    render(<ProfileFaceEnrollmentCard />);
    fireEvent.change(document.querySelector('input[capture]') as HTMLInputElement, {
      target: { files: [new File(['heic'], 'IMG_0004.HEIC', { type: 'image/heic' })] },
    });
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('hrm:faceEnroll.toasts.enrollError', 'errors:FACE_INVALID_IMAGE'));
    expect(enrollMutate).not.toHaveBeenCalled();
  });

  it('dang gui anh chup qua input capture -> spinner o nut camera (khong phai nut tai anh), ca 2 nut bi khoa', () => {
    setWebcam(false);
    enrollState.isPending = true;
    enrollState.variables = { source: 'SELF_CAMERA' };
    render(<ProfileFaceEnrollmentCard />);
    const camera = screen.getByRole('button', { name: /hrm:faceEnroll\.cameraButton/ });
    const upload = screen.getByRole('button', { name: /hrm:faceEnroll\.uploadButton/ });
    expect(within(camera).getByRole('status')).toBeInTheDocument();
    expect(within(upload).queryByRole('status')).toBeNull();
    expect(camera).toBeDisabled();
    expect(upload).toBeDisabled();
  });

  it('co webcam -> khong render input capture, nut camera mo CheckInCamera nhu cu', () => {
    setWebcam(true);
    render(<ProfileFaceEnrollmentCard />);
    expect(document.querySelector('input[capture]')).toBeNull();
    openCameraThroughConsent();
    expect(cameraProps).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, mode: 'enroll' }));
  });

  it('da dang ky + co webcam -> nut "Thu nhan dien" mo camera rieng, anh chup gui di doi chieu', () => {
    setWebcam(true);
    statusState.status = 'ACTIVE';
    render(<ProfileFaceEnrollmentCard />);
    fireEvent.click(screen.getByRole('button', { name: /hrm:faceEnroll\.testButton/ }));
    expect(testCameraProps).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, title: 'hrm:faceEnroll.testModalTitle' }));
    const photo = new Blob(['selfie'], { type: 'image/jpeg' });
    testCameraProps.mock.lastCall?.[0].onConfirm(photo);
    expect(faceTestMutate).toHaveBeenCalledWith(photo, expect.anything());
    expect(enrollMutate).not.toHaveBeenCalled();
  });

  it('chua dang ky -> khong co nut "Thu nhan dien"', () => {
    setWebcam(true);
    render(<ProfileFaceEnrollmentCard />);
    expect(screen.queryByRole('button', { name: /hrm:faceEnroll\.testButton/ })).toBeNull();
  });
});
