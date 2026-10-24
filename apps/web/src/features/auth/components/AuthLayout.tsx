import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

export function AuthLayout({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 antialiased">
      {/* Nút chọn ngôn ngữ */}
      <div className="absolute right-6 top-6 z-20">
        <LanguageSwitcher />
      </div>
      <div className={`relative z-10 ${wide ? 'w-full max-w-3xl' : 'w-full max-w-lg'}`}>
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0E5E5E] text-base font-bold text-white">
            EFS
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 max-w-sm sm:max-w-none">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-[#E5E4E0] bg-white p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
