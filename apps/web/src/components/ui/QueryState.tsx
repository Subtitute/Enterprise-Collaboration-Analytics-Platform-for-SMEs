import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FullPageSpinner } from './Spinner';
import { EmptyState } from './EmptyState';
import { Button } from './Button';
import { AlertCircleIcon, RefreshIcon } from './Icons';

interface QueryStateProps {
  isLoading?: boolean;
  isError?: boolean;
  /** Goi lai query (thuong la `query.refetch`). Bo qua thi nut "Thu lai" se khong hien. */
  onRetry?: () => void;
  /** Tuy chinh giao dien khi dang tai - mac dinh la FullPageSpinner. */
  loadingFallback?: ReactNode;
  loadingLabel?: string;
  errorTitle?: string;
  errorDescription?: string;
  children: ReactNode;
}

/**
 * Wrapper chuan hoa 3 trang thai bat buoc cho moi bang/danh sach (Wireframe.md muc 0):
 * loading (skeleton/spinner) - empty - error (thong bao + nut "Thu lai"). Component nay chi
 * xu ly 2 nhanh loading/error; nhanh "empty" van do component con (children) tu quyet dinh
 * dua tren du lieu da tai xong, de giu nguyen copy/CTA rieng cua tung trang.
 */
export const QueryState = memo(function QueryState({ isLoading, isError, onRetry, loadingFallback, loadingLabel, errorTitle, errorDescription, children }: QueryStateProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <>{loadingFallback ?? <FullPageSpinner label={loadingLabel ?? t('common:queryState.loading')} />}</>;
  }

  if (isError) {
    return (
      <EmptyState
        icon={<AlertCircleIcon className="h-10 w-10 text-rose-400" />}
        title={errorTitle ?? t('common:queryState.errorTitle')}
        description={errorDescription ?? t('common:queryState.errorDescription')}
        action={
          onRetry && (
            <Button variant="outline" onClick={onRetry}>
              <RefreshIcon className="h-4 w-4" /> {t('common:queryState.retry')}
            </Button>
          )
        }
      />
    );
  }

  return <>{children}</>;
});

