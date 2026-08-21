import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useRegisterOrganization } from './hooks';
import { AuthLayout } from './components/AuthLayout';
import { FormField, Input, PasswordInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CheckIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface WizardData {
  organizationName: string;
  taxCode: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
  confirmPassword: string;
}

export function RegisterPage() {
  const { t } = useTranslation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const registerOrg = useRegisterOrganization();

  const STEPS = [
    { step: 1, label: t('auth:registerPage.steps.organization') },
    { step: 2, label: t('auth:registerPage.steps.adminAccount') },
    { step: 3, label: t('auth:registerPage.steps.complete') },
  ];

  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({
    organizationName: '',
    taxCode: '',
    adminFullName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (accessToken) return <Navigate to="/dashboard" replace />;

  function update<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function validateStep1() {
    const next: Record<string, string> = {};
    if (!data.organizationName.trim()) next.organizationName = t('auth:registerPage.errors.organizationNameRequired');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateStep2() {
    const next: Record<string, string> = {};
    if (!data.adminFullName.trim()) next.adminFullName = t('auth:registerPage.errors.adminFullNameRequired');
    if (!data.adminEmail.trim()) next.adminEmail = t('auth:registerPage.errors.adminEmailRequired');
    else if (!EMAIL_RE.test(data.adminEmail.trim())) next.adminEmail = t('auth:registerPage.errors.adminEmailInvalid');
    if (!data.adminPassword) next.adminPassword = t('auth:registerPage.errors.adminPasswordRequired');
    else if (data.adminPassword.length < 8) next.adminPassword = t('auth:registerPage.errors.adminPasswordTooShort');
    if (data.confirmPassword !== data.adminPassword) next.confirmPassword = t('auth:registerPage.errors.confirmPasswordMismatch');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleNext(e: FormEvent) {
    e.preventDefault();
    if (step === 1 && validateStep1()) setStep(2);
  }

  function handleFinish(e: FormEvent) {
    e.preventDefault();
    if (!validateStep2()) return;
    setStep(3);
    registerOrg.mutate({
      organizationName: data.organizationName.trim(),
      taxCode: data.taxCode.trim() || undefined,
      adminFullName: data.adminFullName.trim(),
      adminEmail: data.adminEmail.trim(),
      adminPassword: data.adminPassword,
    });
  }

  return (
    <AuthLayout title={t('auth:registerPage.title')} subtitle={t('auth:registerPage.subtitle')} wide>
      <ol className="mb-7 flex items-center justify-between">
        {STEPS.map((s, i) => (
          <li key={s.step} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                  step > s.step
                    ? 'bg-primary-600 text-white'
                    : step === s.step
                      ? 'border-2 border-primary-600 text-primary-600'
                      : 'border-2 border-slate-200 text-slate-400',
                )}
              >
                {step > s.step ? <CheckIcon className="h-4 w-4" /> : s.step}
              </span>
              <span className={cn('text-xs font-medium', step >= s.step ? 'text-slate-700' : 'text-slate-400')}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('mx-2 mb-5 h-0.5 flex-1 rounded', step > s.step ? 'bg-primary-600' : 'bg-slate-200')} />
            )}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <form onSubmit={handleNext} className="space-y-4" noValidate>
          <FormField label={t('auth:registerPage.step1.organizationNameLabel')} htmlFor="organizationName" error={errors.organizationName} required>
            <Input
              id="organizationName"
              placeholder={t('auth:registerPage.step1.organizationNamePlaceholder')}
              value={data.organizationName}
              onChange={(e) => update('organizationName', e.target.value)}
            />
          </FormField>
          <FormField label={t('auth:registerPage.step1.taxCodeLabel')} htmlFor="taxCode" hint={t('auth:registerPage.step1.taxCodeHint')}>
            <Input id="taxCode" placeholder="0123456789" value={data.taxCode} onChange={(e) => update('taxCode', e.target.value)} />
          </FormField>
          <Button type="submit" className="w-full">
            {t('auth:registerPage.step1.continue')}
          </Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleFinish} className="space-y-4" noValidate>
          <FormField label={t('auth:registerPage.step2.adminFullNameLabel')} htmlFor="adminFullName" error={errors.adminFullName} required>
            <Input
              id="adminFullName"
              placeholder={t('auth:registerPage.step2.adminFullNamePlaceholder')}
              value={data.adminFullName}
              onChange={(e) => update('adminFullName', e.target.value)}
            />
          </FormField>
          <FormField label={t('auth:registerPage.step2.adminEmailLabel')} htmlFor="adminEmail" error={errors.adminEmail} required>
            <Input
              id="adminEmail"
              type="email"
              placeholder={t('auth:registerPage.step2.adminEmailPlaceholder')}
              value={data.adminEmail}
              onChange={(e) => update('adminEmail', e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('auth:registerPage.step2.adminPasswordLabel')} htmlFor="adminPassword" error={errors.adminPassword} required>
              <PasswordInput
                id="adminPassword"
                placeholder={t('auth:registerPage.step2.adminPasswordPlaceholder')}
                value={data.adminPassword}
                onChange={(e) => update('adminPassword', e.target.value)}
              />
            </FormField>
            <FormField label={t('auth:registerPage.step2.confirmPasswordLabel')} htmlFor="confirmPassword" error={errors.confirmPassword} required>
              <PasswordInput
                id="confirmPassword"
                placeholder={t('auth:registerPage.step2.confirmPasswordPlaceholder')}
                value={data.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
              />
            </FormField>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
              {t('auth:registerPage.step2.back')}
            </Button>
            <Button type="submit" className="flex-1" isLoading={registerOrg.isPending}>
              {t('auth:registerPage.step2.finish')}
            </Button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          {registerOrg.isError ? (
            <>
              <p className="text-sm font-medium text-rose-600">{t('auth:registerPage.step3.errorMessage')}</p>
              <Button variant="outline" onClick={() => setStep(2)}>
                {t('auth:registerPage.step3.backToEdit')}
              </Button>
            </>
          ) : (
            <>
              <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-primary-100 text-primary-600">
                <CheckIcon className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium text-slate-700">{t('auth:registerPage.step3.inProgress')}</p>
            </>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        {t('auth:registerPage.hasAccount')}{' '}
        <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
          {t('auth:registerPage.loginLink')}
        </Link>
      </p>
    </AuthLayout>
  );
}
