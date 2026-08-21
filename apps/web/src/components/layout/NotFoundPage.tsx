import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <p className="text-6xl font-bold text-primary-600">404</p>
      <p className="text-lg font-semibold text-slate-900">{t('common:notFound.title')}</p>
      <p className="max-w-sm text-sm text-slate-500">{t('common:notFound.description')}</p>
      <Link to="/dashboard">
        <Button className="mt-2">{t('common:notFound.backToDashboard')}</Button>
      </Link>
    </div>
  );
}
