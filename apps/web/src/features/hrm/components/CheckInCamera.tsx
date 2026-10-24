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
  mode = 'checkin',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (photo: Blob, location?: CheckInLocation) => void;
  isSubmitting?: boolean;
  // 24/10/2026: Face recognition - tai su dung CHINH component nay cho man "Dang ky khuon mat"
  // (ProfilePage.tsx) thay vi viet lai tu dau (cung logic camera lifecycle/retake). `mode='enroll'`
  // CHI doi vai khoa i18n (tieu de/nut) + bo qua xin vi tri GPS (khong can cho dang ky khuon mat) -
  // khong doi logic camera/anh.
  mode?: 'checkin' | 'enroll';
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Xin vi tri SONG SONG voi camera ngay khi mo modal (khong doi den luc bam Xac nhan) de khong
  // lam cham luc gui - ket qua (co the la undefined, xem getCurrentLocationSoft()) duoc doc lai
  // trong handleConfirm().
  const locationRef = useRef<Promise<CheckInLocation | undefined>>(Promise.resolve(undefined));
  // 26/08/2026: Fix 6b - co "con dang mo modal" doc ngay SAU khi getUserMedia() resolve (xem
  // startCamera() ben duoi) - dat true khi effect vong doi mo camera chay, dat false trong cleanup
  // cua CHINH effect do (khi `open` chuyen ve false HOAC component unmount).
  const isOpenRef = useRef(false);
  const [status, setStatus] = useState<CameraStatus>('requesting');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  // 26/08/2026: Fix 6a - gom logic "xoa preview" vao 1 ham duy nhat, LUON thu hoi Object URL truoc
  // khi xoa - truoc ban sua nay chi handleRetake() thu hoi URL.revokeObjectURL(previewUrl), con
  // nhanh `!open` cua effect vong doi ben duoi lai xoa thang previewUrl (setPreviewUrl(null)) MA
  // KHONG thu hoi - RO RI 1 blob URL moi lan modal dong sau khi chup anh (bao gom ca luong cham
  // cong THANH CONG: onConfirm() la ham dong bo do component cha truyen vao, cha xu ly mutation
  // roi tu dong `open=false` de dong modal - dan thang qua nhanh `!open` bi ro ri nay). Dung dang
  // ham cap nhat cua setState (prev => ...) de LUON doc dung gia tri previewUrl MOI NHAT tai thoi
  // diem chay, tranh phu thuoc closure cu trong dependency array [open] cua effect.
  function clearPreview() {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPreviewBlob(null);
  }

  async function startCamera() {
    setStatus('requesting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      // 26/08/2026: Fix 6b - sua loi thuc te - getUserMedia() la async, khong co gi dam bao modal
      // VAN CON MO luc no resolve (nguoi dung co the da dong modal trong luc trinh duyet dang cho
      // nguoi dung cap quyen camera, co the mat vai giay). Truoc ban sua nay, stream tra ve luon
      // duoc gan thang vao streamRef.current du modal da dong tu truoc - tao ra 1 camera stream
      // "mo coi" khong ai dung/khong ai biet de tat (den bao camera cua may van sang lien tuc), va
      // lan mo modal KE TIEP se GHI DE streamRef.current bang stream MOI ma khong dung stream cu
      // (stream mo coi khong bao gio duoc stop()). Kiem tra isOpenRef NGAY SAU khi resolve - neu
      // modal da dong, dung ngay track cua stream VUA nhan duoc thay vi gan vao streamRef.current.
      if (!isOpenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
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
      clearPreview();
      return;
    }
    isOpenRef.current = true;
    startCamera();
    if (mode !== 'enroll') locationRef.current = getCurrentLocationSoft();
    return () => {
      isOpenRef.current = false;
      stopStream();
    };
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
    clearPreview();
    startCamera();
  }

  async function handleConfirm() {
    if (!previewBlob) return;
    const location = await locationRef.current;
    onConfirm(previewBlob, location);
  }

  const titleKey = mode === 'enroll' ? 'hrm:faceEnroll.cameraModalTitle' : 'hrm:checkInCamera.modalTitle';
  const captureKey = mode === 'enroll' ? 'hrm:faceEnroll.captureButton' : 'hrm:checkInCamera.captureButton';
  const confirmKey = mode === 'enroll' ? 'hrm:faceEnroll.confirmButton' : 'hrm:checkInCamera.confirmButton';
  const previewAltKey = mode === 'enroll' ? 'hrm:faceEnroll.previewAlt' : 'hrm:checkInCamera.previewAlt';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(titleKey)}
      size="sm"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('hrm:checkInCamera.cancelButton')}
          </Button>
          {previewUrl ? (
            <>
              <Button type="button" variant="secondary" onClick={handleRetake}>
                <RefreshIcon className="h-4 w-4" /> {t('hrm:checkInCamera.retakeButton')}
              </Button>
              <Button type="button" variant="primary" onClick={handleConfirm} isLoading={isSubmitting}>
                {t(confirmKey)}
              </Button>
            </>
          ) : (
            <Button type="button" variant="primary" onClick={handleCapture} disabled={status !== 'ready'}>
              <CameraIcon className="h-4 w-4" /> {t(captureKey)}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-900">
          {status === 'requesting' && (
            <div className="flex h-full items-center justify-center text-accent">
              <Spinner className="h-8 w-8 text-accent" />
            </div>
          )}
          {status === 'denied' && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-slate-300">
              <p>{t('hrm:checkInCamera.cameraDenied')}</p>
              <Button size="sm" variant="secondary" onClick={startCamera}>
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
            <img src={previewUrl} alt={t(previewAltKey)} className="h-full w-full object-cover" />
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
      </div>
    </Modal>
  );
}
