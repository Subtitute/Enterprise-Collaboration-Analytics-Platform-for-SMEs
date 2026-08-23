import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useLogin } from './hooks';
import { AuthLayout } from './components/AuthLayout';
import { FormField, Input, PasswordInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { t } = useTranslation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const login = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorKeys, setErrorKeys] = useState<{ email?: 'emailRequired' | 'emailInvalid'; password?: 'passwordRequired' }>({});

  if (accessToken) return <Navigate to="/dashboard" replace />;

  function validate() {
    const next: typeof errorKeys = {};
    if (!email.trim()) next.email = 'emailRequired';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'emailInvalid';
    if (!password) next.password = 'passwordRequired';
    setErrorKeys(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    login.mutate({ email: email.trim(), password });
  }

  const emailError = errorKeys.email ? t(`auth:loginPage.errors.${errorKeys.email}`) : undefined;
  const passwordError = errorKeys.password ? t(`auth:loginPage.errors.${errorKeys.password}`) : undefined;

  return (
    <AuthLayout title={t('auth:loginPage.title')} subtitle={t('auth:loginPage.subtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('auth:loginPage.emailLabel')} htmlFor="email" error={emailError} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('auth:loginPage.emailPlaceholder')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errorKeys.email) setErrorKeys((prev) => ({ ...prev, email: undefined }));
            }}
          />
        </FormField>
        <FormField label={t('auth:loginPage.passwordLabel')} htmlFor="password" error={passwordError} required>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errorKeys.password) setErrorKeys((prev) => ({ ...prev, password: undefined }));
            }}
          />
        </FormField>
        <Button type="submit" className="w-full" isLoading={login.isPending}>
          {t('auth:loginPage.submit')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        {t('auth:loginPage.noOrganization')}{' '}
        <Link to="/register" className="font-medium text-primary-600 hover:text-primary-700">
          {t('auth:loginPage.registerLink')}
        </Link>
      </p>
    </AuthLayout>
  );
}
