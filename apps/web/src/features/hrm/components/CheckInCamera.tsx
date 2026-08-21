import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { CameraIcon, RefreshIcon } from '@/components/ui/Icons';

type CameraStatus = 'requesting' | 'ready' | 'denied' | 'unavailable';

export interface CheckInLocation {
  latitude: number;
  longitude: number;
}

/**
 * Lay vi tri GPS hien tai (Technical_Spec.md muc 17) - CO Y KHONG chan/khong hien loi neu that
 * bai (tu choi quyen, khong ho tro, timeout): tra ve `undefined`, view goi ham nay khong bao gio
 * throw. Day chi la 1 tin hieu THEM danh cho Manager doi chieu, khong phai dieu kien bat buoc de
 * cham cong (xem quyet dinh thiet ke o AttendanceService.computeIsOnSite(), apps/hrm-service).
 */
function getCurrentLocationSoft(): Promise<CheckInLocation | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(undefined);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(undefined),
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

/**
 * Component camera cham cong (photo-proof check-in/out) - Technical_Spec.md muc 17. LAN DAU
 * TIEN dung navigator.mediaDevices.getUserMedia()/<video>/<canvas> trong repo nay (da xac nhan
 * qua grep toan bo apps/web/src: khong co tien le nao truoc do).
 *
 * QUYET DINH THIET KE: chi chup 1 anh lam BANG CHUNG dinh kem (danh tinh xac
 * dinh qua tai khoan da dang nhap, giong moi endpoint khac), KHONG nhan dien khuon mat bang ML -
 * giu tinh nang don gian, khong co rui ro sai so nhan dien luc demo truc tiep, khong phat sinh du
 * lieu sinh trac hoc can xu ly rieng.
 *
 * 13/08/2026: bo sung lay vi tri GPS (navigator.geolocation) song song voi camera - CHI la 1 tin
 * hieu THEM (co "on-site"/"off-site") de Manager doi chieu voi anh, KHONG chan xac nhan neu
 * thieu/tu choi quyen vi tri (xem getCurrentLocationSoft() ben duoi va
 * AttendanceService.computeIsOnSite() o backend).
 */
export function CheckInCamera({
  open,
  onClose,
  onConfirm,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (photo: Blob, location?: CheckInLocation) => void;
  isSubmitting?: boolean;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Xin vi tri SONG SONG voi camera ngay khi mo modal (khong doi den luc bam Xac nhan) de khong
  // lam cham luc gui - ket qua (co the la undefined, xem getCurrentLocationSoft()) duoc doc lai
  // trong handleConfirm().
  const locationRef = useRef<Promise<CheckInLocation | undefined>>(Promise.resolve(undefined));
  const [status, setStatus] = useState<CameraStatus>('requesting');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setStatus('requesting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('ready');
    } catch {
      // getUserMedia tu choi ca 2 truong hop (nguoi dung tu choi cap quyen VA khong tim thay
      // camera nao) qua cung 1 exception - khong the phan biet tin cay tu error.name tren moi
      // trinh duyet, nen gop chung thanh 1 thong bao ro rang kem nut "Thử lại".
      setStatus('denied');
    }
  }

  // Xin quyen camera moi khi modal duoc mo, dung stream khi dong - KHONG duoc de camera "treo"
  // (den bao camera dang bat) sau khi nguoi dung da dong modal.
  useEffect(() => {
    if (!open) {
      stopStream();
      setPreviewUrl(null);
      setPreviewBlob(null);
      return;
    }
    startCamera();
    locationRef.current = getCurrentLocationSoft();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stopStream();
      },
      'image/jpeg',
      0.9,
    );
  }

  function handleRetake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    startCamera();
  }

  async function handleConfirm() {
    if (!previewBlob) return;
    const location = await locationRef.current;
    onConfirm(previewBlob, location);
  }

  return (
    <Modal open={open} onClose={onClose} title={t('hrm:checkInCamera.modalTitle')} size="sm">
      <div className="space-y-4">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-900">
          {status === 'requesting' && (
            <div className="flex h-full items-center justify-center text-slate-300">
              <Spinner />
            </div>
          )}
          {status === 'denied' && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-slate-300">
              <p>{t('hrm:checkInCamera.cameraDenied')}</p>
              <Button size="sm" variant="outline" onClick={startCamera}>
                <RefreshIcon className="h-4 w-4" /> {t('hrm:checkInCamera.retryButton')}
              </Button>
            </div>
          )}
          {status === 'unavailable' && (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-slate-300">
              {t('hrm:checkInCamera.cameraUnavailable')}
            </div>
          )}
          {previewUrl ? (
            <img src={previewUrl} alt={t('hrm:checkInCamera.previewAlt')} className="h-full w-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              className={status === 'ready' ? 'h-full w-full object-cover' : 'hidden'}
              muted
              playsInline
            />
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('hrm:checkInCamera.cancelButton')}
          </Button>
          {previewUrl ? (
            <>
              <Button type="button" variant="outline" onClick={handleRetake}>
                <RefreshIcon className="h-4 w-4" /> {t('hrm:checkInCamera.retakeButton')}
              </Button>
              <Button type="button" onClick={handleConfirm} isLoading={isSubmitting}>
                {t('hrm:checkInCamera.confirmButton')}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={handleCapture} disabled={status !== 'ready'}>
              <CameraIcon className="h-4 w-4" /> {t('hrm:checkInCamera.captureButton')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
