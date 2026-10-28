import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { AlertTriangleIcon, CameraIcon, CheckCircleIcon, InfoIcon, UploadIcon, XIcon } from '@/components/ui/Icons';
import { extractErrorMessage } from '@/lib/api-client';
import { ImageNormalizeError, normalizeFacePhoto } from '@/lib/image-normalize';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { CheckInCamera } from '@/features/hrm/components/CheckInCamera';
import type { FaceInspectResult } from '@/types';
import { inspectFacePhoto } from '../api';
import { canUseWebcam } from '../camera';
import { useUploadUserFace } from '../hooks';

/**
 * 26/10/2026: hop "Tai anh nhan dien" cua Org Admin/Manager (Wireframe muc 16.3) - chon tep -> chuan
 * hoa JPEG o trinh duyet -> POST /ml/face/inspect (khong luu gi) -> hien ket qua; loi chan (khong
 * mat, nhieu mat, mat qua nho, trung >= 0,5) khoa nut Gui. Gui = ban CHO nhan vien xac nhan.
 *
 * 27/10/2026: them "Chup bang camera" - may co webcam trong secure context thi mo CheckInCamera (dung
 * lai component cham cong/tu dang ky), dien thoai mo qua http LAN (khong co getUserMedia) thi mo app
 * camera qua <input accept="image/*" capture="environment"> (quan ly chup nhan vien). Anh chup di
 * CHUNG duong voi tep chon tu may (chuan hoa -> /inspect -> loi chan khoa "Gui anh" -> ban CHO), quy
 * tac dong y khong doi: anh tai ho, chup hay chon tep, van cho chinh nhan vien xac nhan.
 */
export function FaceUploadDialog({ open, onClose, userId, userName }: { open: boolean; onClose: () => void; userId: string; userName: string }) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadUserFace();
  const { map: userNameMap } = useUserNameMap();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [inspect, setInspect] = useState<FaceInspectResult | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const webcam = canUseWebcam();
  // 28/10/2026: so thu tu lan xu ly anh - dong hop khi /inspect con dang cho thi ket qua ve SAU duoc bo
  // qua (truoc day dong roi mo lai hop van hien dong "1 khuon mat..."/loi cua anh cu, khong co anh).
  const runRef = useRef(0);

  useEffect(() => {
    if (!open) {
      runRef.current += 1;
      setPhoto(null);
      setInspect(null);
      setInspectError('');
      setInspecting(false);
      setIsCameraOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  // 27/10/2026: xoa anh cu ngay khi xu ly anh moi - truoc day anh moi giai ma hong van hien xem truoc
  // anh CU canh loi "Anh khong hop le", de nham la anh cu bi loi (chup lai bang camera hay gap).
  async function processPhoto(source: Blob) {
    const run = ++runRef.current;
    setPhoto(null);
    setInspect(null);
    setInspectError('');
    setInspecting(true);
    try {
      const normalized = await normalizeFacePhoto(source);
      if (run !== runRef.current) return;
      setPhoto(normalized);
      const result = await inspectFacePhoto(normalized, userId);
      if (run === runRef.current) setInspect(result);
    } catch (err) {
      if (run === runRef.current) setInspectError(err instanceof ImageNormalizeError ? t('errors:FACE_INVALID_IMAGE') : extractErrorMessage(err));
    } finally {
      if (run === runRef.current) setInspecting(false);
    }
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void processPhoto(file);
  }

  function handleCamera() {
    if (webcam) setIsCameraOpen(true);
    else captureInputRef.current?.click();
  }

  const duplicateName = inspect?.duplicateUserId ? userNameMap[inspect.duplicateUserId] : undefined;

  return (
    <>
      <Modal open={open} onClose={onClose} title={t('admin:facePanel.uploadTitle', { name: userName })} preventCloseWhilePending={upload.isPending}>
        <div className="space-y-4">
          <div className="flex gap-4">
            {/* 28/10/2026: khoa o chon anh khi dang kiem tra/dang gui (giong nut camera) - truoc day chon anh B
                trong luc anh A con cho /inspect thi ket qua cua A ve sau hien canh anh B va mo khoa "Gui anh"
                cho anh B chua duoc kiem tra. */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={inspecting || upload.isPending}
              className="flex h-32 w-28 shrink-0 items-center justify-center overflow-hidden rounded-radius-sm border-2 border-dashed border-border-strong bg-bg-subtle text-text-tertiary hover:border-accent cursor-pointer"
              aria-label={t('admin:facePanel.chooseFile')}
            >
              {previewUrl ? <img src={previewUrl} alt="" className="h-full w-full object-cover" /> : <UploadIcon className="h-6 w-6" />}
            </button>
            <div className="min-w-0 flex-1 space-y-1.5 text-[13px]">
              {inspecting && (
                <p className="flex items-center gap-2 text-text-secondary">
                  <Spinner className="h-4 w-4 text-accent" /> {t('admin:facePanel.inspecting')}
                </p>
              )}
              {!inspecting && !photo && !inspectError && <p className="text-text-secondary">{t('admin:facePanel.chooseFileHint')}</p>}
              {inspectError && (
                <p className="flex items-start gap-1.5 text-error">
                  <XIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {inspectError}
                </p>
              )}
              {inspect && (
                <>
                  {inspect.errorCode ? (
                    <p className="flex items-start gap-1.5 text-error">
                      <XIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {inspect.errorCode === 'FACE_DUPLICATE' && duplicateName
                        ? t('admin:facePanel.duplicateWith', { name: duplicateName })
                        : t(`errors:${inspect.errorCode}`)}
                    </p>
                  ) : (
                    <p className="flex items-start gap-1.5 text-success">
                      <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {t('admin:facePanel.oneFace', { height: inspect.faceHeight })}
                    </p>
                  )}
                  {inspect.warnings.map((w) => (
                    <p key={w} className="flex items-start gap-1.5 text-warning">
                      <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {w === 'FACE_POSSIBLE_DUPLICATE' && duplicateName ? t('admin:facePanel.possibleDuplicateWith', { name: duplicateName }) : t(`errors:${w}`)}
                    </p>
                  ))}
                </>
              )}
              <div className="pt-1">
                <Button type="button" variant="secondary" size="sm" onClick={handleCamera} disabled={inspecting || upload.isPending}>
                  <CameraIcon className="h-3.5 w-3.5 mr-1.5" />
                  {t('admin:facePanel.capture')}
                </Button>
              </div>
            </div>
          </div>
          <p className="flex items-start gap-2 rounded-radius-sm bg-info-soft px-3 py-2 text-[12px] text-info">
            <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t('admin:facePanel.pendingNote')}
          </p>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />
          {!webcam && <input ref={captureInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />}
          <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={upload.isPending}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              type="button"
              disabled={!photo || !inspect?.ok || inspecting}
              isLoading={upload.isPending}
              onClick={() => photo && upload.mutate({ userId, photo }, { onSuccess: onClose })}
            >
              {t('admin:facePanel.send')}
            </Button>
          </div>
        </div>
      </Modal>

      <CheckInCamera
        open={open && isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onConfirm={(captured) => {
          setIsCameraOpen(false);
          void processPhoto(captured);
        }}
        mode="enroll"
        facingMode="environment"
        confirmLabel={t('admin:facePanel.useCapturedPhoto')}
      />
    </>
  );
}
