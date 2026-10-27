import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { UserIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { useFacePhotoUrl } from '../hooks';

/**
 * 26/10/2026: o hien anh nhan dien tai qua proxy ml-service (blob URL cuc bo, khong cache). `fetcher`
 * null = khong co anh (vd ban dang ky truoc ngay luu anh goc). Bam vao anh -> onOpen (xem anh lon).
 */
export function FacePhotoBox({
  fetcher,
  reloadKey,
  alt,
  className,
  onOpen,
}: {
  fetcher: (() => Promise<Blob>) | null;
  reloadKey: string;
  alt: string;
  className?: string;
  onOpen?: (url: string) => void;
}) {
  const { t } = useTranslation();
  const { url, failed } = useFacePhotoUrl(fetcher, reloadKey);
  const box = cn('flex h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded-radius-sm border border-border-subtle bg-bg-subtle', className);
  if (!fetcher) {
    return (
      <div className={box} title={t('hrm:face.noStoredPhoto')}>
        <UserIcon className="h-6 w-6 text-text-tertiary" />
      </div>
    );
  }
  if (failed) return <div className={cn(box, 'p-2 text-center text-[11px] text-text-tertiary')}>{t('hrm:face.photoLoadError')}</div>;
  if (!url) {
    return (
      <div className={box}>
        <Spinner className="h-4 w-4 text-accent" />
      </div>
    );
  }
  return (
    <button type="button" className={cn(box, 'cursor-zoom-in')} onClick={() => onOpen?.(url)} disabled={!onOpen} aria-label={alt}>
      <img src={url} alt={alt} className="h-full w-full object-cover" />
    </button>
  );
}
