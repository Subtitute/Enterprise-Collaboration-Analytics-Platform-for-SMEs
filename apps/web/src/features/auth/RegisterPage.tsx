import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
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

const STEPS = [
  { step: 1, label: 'Thông tin tổ chức' },
  { step: 2, label: 'Tài khoản quản trị' },
  { step: 3, label: 'Hoàn tất' },
];

export function RegisterPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const registerOrg = useRegisterOrganization();

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
    if (!data.organizationName.trim()) next.organizationName = 'Vui lòng nhập tên tổ chức';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function validateStep2() {
    const next: Record<string, string> = {};
    if (!data.adminFullName.trim()) next.adminFullName = 'Vui lòng nhập họ tên';
    if (!data.adminEmail.trim()) next.adminEmail = 'Vui lòng nhập email';
    else if (!EMAIL_RE.test(data.adminEmail.trim())) next.adminEmail = 'Email không hợp lệ';
    if (!data.adminPassword) next.adminPassword = 'Vui lòng nhập mật khẩu';
    else if (data.adminPassword.length < 8) next.adminPassword = 'Mật khẩu tối thiểu 8 ký tự';
    if (data.confirmPassword !== data.adminPassword) next.confirmPassword = 'Mật khẩu xác nhận không khớp';
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
    <AuthLayout title="Đăng ký tổ chức mới" subtitle="Khởi tạo không gian làm việc cho doanh nghiệp của bạn" wide>
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
          <FormField label="Tên tổ chức" htmlFor="organizationName" error={errors.organizationName} required>
            <Input
              id="organizationName"
              placeholder="Công ty TNHH ABC"
              value={data.organizationName}
              onChange={(e) => update('organizationName', e.target.value)}
            />
          </FormField>
          <FormField label="Mã số thuế" htmlFor="taxCode" hint="Không bắt buộc">
            <Input id="taxCode" placeholder="0123456789" value={data.taxCode} onChange={(e) => update('taxCode', e.target.value)} />
          </FormField>
          <Button type="submit" className="w-full">
            Tiếp tục
          </Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleFinish} className="space-y-4" noValidate>
          <FormField label="Họ và tên quản trị viên" htmlFor="adminFullName" error={errors.adminFullName} required>
            <Input
              id="adminFullName"
              placeholder="Nguyễn Văn A"
              value={data.adminFullName}
              onChange={(e) => update('adminFullName', e.target.value)}
            />
          </FormField>
          <FormField label="Email quản trị viên" htmlFor="adminEmail" error={errors.adminEmail} required>
            <Input
              id="adminEmail"
              type="email"
              placeholder="admin@congty.com"
              value={data.adminEmail}
              onChange={(e) => update('adminEmail', e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Mật khẩu" htmlFor="adminPassword" error={errors.adminPassword} required>
              <PasswordInput
                id="adminPassword"
                placeholder="Tối thiểu 8 ký tự"
                value={data.adminPassword}
                onChange={(e) => update('adminPassword', e.target.value)}
              />
            </FormField>
            <FormField label="Xác nhận mật khẩu" htmlFor="confirmPassword" error={errors.confirmPassword} required>
              <PasswordInput
                id="confirmPassword"
                placeholder="Nhập lại mật khẩu"
                value={data.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
              />
            </FormField>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
              Quay lại
            </Button>
            <Button type="submit" className="flex-1" isLoading={registerOrg.isPending}>
              Hoàn tất đăng ký
            </Button>
          </div>
        </form>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          {registerOrg.isError ? (
            <>
              <p className="text-sm font-medium text-rose-600">Đăng ký chưa thành công. Vui lòng kiểm tra lại thông tin.</p>
              <Button variant="outline" onClick={() => setStep(2)}>
                Quay lại chỉnh sửa
              </Button>
            </>
          ) : (
            <>
              <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-primary-100 text-primary-600">
                <CheckIcon className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium text-slate-700">Đang khởi tạo tổ chức và đăng nhập cho bạn…</p>
            </>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        Đã có tài khoản?{' '}
        <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
