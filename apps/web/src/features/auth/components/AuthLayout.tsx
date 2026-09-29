import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { BrandLogoIcon } from '@/components/ui/Icons';

export function AuthLayout({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 antialiased">
      {/* Nút chọn ngôn ngữ */}
      <div className="absolute right-6 top-6 z-20">
        <LanguageSwitcher />
      </div>
      <div className={`relative z-10 ${wide ? 'w-full max-w-3xl' : 'w-full max-w-lg'}`}>
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1E3A8A] text-white shadow-md">
            <BrandLogoIcon className="h-6 w-6 text-white" />
          </div>
          <span className="font-heading text-lg font-bold tracking-wider text-[#1E3A8A]">
            ECAP
          </span>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#1E3A8A]">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 max-w-sm sm:max-w-none">{subtitle}</p>}
        </div>
        <div className="rounded-md border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
