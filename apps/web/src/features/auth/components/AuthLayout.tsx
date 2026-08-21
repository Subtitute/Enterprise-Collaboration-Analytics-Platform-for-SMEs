import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

export function AuthLayout({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-slate-50 px-4 py-10">
      {/* 20/08/2026: goc tren ben phai man hinh dang nhap/dang ky - man hinh nay khong co
          Topbar (AppShell chi bao trang da dang nhap), can 1 vi tri rieng cho LanguageSwitcher. */}
      <LanguageSwitcher className="absolute right-4 top-4" />
      <div className={wide ? 'w-full max-w-xl' : 'w-full max-w-md'}>
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-base font-bold text-white">EC</span>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">{children}</div>
      </div>
    </div>
  );
}
