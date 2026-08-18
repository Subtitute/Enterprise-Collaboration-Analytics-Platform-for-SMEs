import type { ReactNode } from 'react';

export function AuthLayout({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50/70 px-4 py-10 antialiased">
      {/* 1px subtle grid pattern background */}
      <div 
        className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60" 
      />

      {/* Ambient gradient glow orbs behind the card */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[450px] rounded-full bg-sky-300/15 blur-[100px]" />

      {/* Main card container */}
      <div className={`relative z-10 ${wide ? 'w-full max-w-xl' : 'w-full max-w-md'}`}>
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
