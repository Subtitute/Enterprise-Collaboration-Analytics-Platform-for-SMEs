import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

export function AuthLayout({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-slate-50 px-4 py-10">
      {/* 20/08/2026: goc tren ben phai man hinh dang nhap/dang ky - man hinh nay khong co
          Topbar (AppShell chi bao trang da dang nhap), can 1 vi tri rieng cho LanguageSwitcher.
          21/08/2026: sua loi thuc te (phat hien qua chup man hinh kiem tra i18n) - truyen thang
          className="absolute ..." vao LanguageSwitcher se ap dung no cho chinh nut trigger BEN
          TRONG div boc cua Dropdown ("relative inline-block"), khien div boc do sup ve kich thuoc
          0 (con duy nhat cua no da roi khoi luong binh thuong do position:absolute) - nut trigger
          vi vay dinh vi theo goc CUA DIV DA SUP DO ay (troi ve giua man hinh, dung canh the dang
          nhap) thay vi goc tren-phai TOAN TRANG. Boc rieng 1 the div dinh vi tuyet doi o NGOAI
          Dropdown, giu LanguageSwitcher khong nhan className dinh vi nao ca. */}
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className={wide ? 'w-full max-w-xl' : 'w-full max-w-md'}>
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 shadow-md shadow-primary-500/20 text-base font-bold text-white">
            EC
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 max-w-xs">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-xl shadow-slate-200/50 backdrop-blur-md sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
