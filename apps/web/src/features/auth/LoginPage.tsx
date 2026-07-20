import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useLogin } from './hooks';
import { AuthLayout } from './components/AuthLayout';
import { FormField, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const login = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  if (accessToken) return <Navigate to="/dashboard" replace />;

  function validate() {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Vui lòng nhập email';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Email không hợp lệ';
    if (!password) next.password = 'Vui lòng nhập mật khẩu';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    login.mutate({ email: email.trim(), password });
  }

  return (
    <AuthLayout title="Đăng nhập" subtitle="Nền tảng Cộng tác & Phân tích Doanh nghiệp cho SME">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label="Email" htmlFor="email" error={errors.email} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="ban@congty.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <FormField label="Mật khẩu" htmlFor="password" error={errors.password} required>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <Button type="submit" className="w-full" isLoading={login.isPending}>
          Đăng nhập
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Chưa có tổ chức?{' '}
        <Link to="/register" className="font-medium text-primary-600 hover:text-primary-700">
          Đăng ký tổ chức mới
        </Link>
      </p>
    </AuthLayout>
  );
}
