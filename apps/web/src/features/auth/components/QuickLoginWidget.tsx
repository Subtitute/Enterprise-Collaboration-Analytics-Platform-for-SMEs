import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, X, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DemoAccount {
  id: 'superAdmin' | 'admin' | 'manager' | 'employee';
  roleNameKey: string;
  descKey: string;
  badgeClass: string;
  email: string;
  password: string;
}

interface QuickLoginWidgetProps {
  accounts: DemoAccount[];
  activeRoleIndex?: number;
  onSelectRole?: (index: number) => void;
  onFillDemo: (acc: DemoAccount) => void;
  onBypassLogin: (acc: DemoAccount) => void;
  isLoading?: boolean;
}

const ROLES_ORDER: { id: DemoAccount['id']; label: string }[] = [
  { id: 'admin', label: 'Admin' },
  { id: 'manager', label: 'Manager' },
  { id: 'employee', label: 'Employee' },
  { id: 'superAdmin', label: 'Super' },
];

export function QuickLoginWidget({
  accounts,
  activeRoleIndex: controlledRoleIndex,
  onSelectRole,
  onFillDemo,
  onBypassLogin,
  isLoading,
}: QuickLoginWidgetProps) {
  const { t } = useTranslation();
  const [internalRoleIndex, setInternalRoleIndex] = useState(0);
  const activeRoleIndex = controlledRoleIndex ?? internalRoleIndex;
  const [isOpen, setIsOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);

  const selectedAccount = accounts[activeRoleIndex] || accounts[0];

  // Click outside & Esc handling
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        pillRef.current &&
        !pillRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        pillRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleCopy = async (text: string, field: 'email' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // Ignored
    }
  };

  const handleRoleClick = (idx: number) => {
    setInternalRoleIndex(idx);
    onSelectRole?.(idx);
    const targetAcc = accounts[idx];
    if (targetAcc) {
      // Cơ chế 1: Chọn role -> tự điền form, không tự submit, không tự đóng panel
      onFillDemo(targetAcc);
    }
  };

  const handleBypassClick = () => {
    // Cơ chế 2: Bypass nhanh -> điền form + submit ngay lập tức, panel tự đóng, hiển thị loading
    setIsOpen(false);
    onBypassLogin(selectedAccount);
  };

  return (
    <>
      {/* Panel trạng thái mở (§B.5) */}
      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('auth:loginPage.demoAccount.title')}
          className={cn(
            'fixed z-40 bg-white border border-border-subtle shadow-md rounded-radius-lg p-4 animate-slide-up',
            'bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-18 right-4 md:right-5',
            'w-[calc(100vw-32px)] max-w-[320px] md:w-80',
          )}
        >
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] leading-4 font-semibold tracking-[0.06em] uppercase text-text-tertiary">
              {t('auth:loginPage.demoAccount.overline')}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={t('common:actions.close')}
              className="p-1 rounded-radius-sm text-text-tertiary hover:text-text-primary hover:bg-bg-subtle transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Role selector - Segmented control 4 ô */}
          <div className="grid grid-cols-4 gap-0.5 bg-bg-muted p-0.5 rounded-radius-sm mb-3">
            {ROLES_ORDER.map(({ id, label }) => {
              const accIdx = accounts.findIndex((a) => a.id === id);
              const isActive = activeRoleIndex === accIdx;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleRoleClick(accIdx)}
                  className={cn(
                    'h-7 text-xs font-medium rounded-[4px] flex items-center justify-center transition-all',
                    isActive
                      ? 'bg-white text-text-primary shadow-xs font-semibold'
                      : 'bg-transparent text-text-secondary hover:text-text-primary',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Thông tin tài khoản */}
          <div className="flex flex-col gap-2 mb-3">
            {/* Khối Email */}
            <div className="bg-bg-subtle border border-border-subtle rounded-radius-sm p-2 flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-text-tertiary">Email</span>
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-xs font-medium text-text-primary truncate">
                  {selectedAccount.email}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedAccount.email, 'email')}
                  title={t('auth:loginPage.demoAccount.copyEmailTitle')}
                  aria-label={t('auth:loginPage.demoAccount.copyEmailTitle')}
                  className="p-1 text-text-tertiary hover:text-text-primary rounded transition-colors"
                >
                  {copiedField === 'email' ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Khối Mật khẩu */}
            <div className="bg-bg-subtle border border-border-subtle rounded-radius-sm p-2 flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-text-tertiary">{t('auth:loginPage.demoAccount.passwordLabel')}</span>
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-xs font-medium text-text-primary">
                  {selectedAccount.password}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedAccount.password, 'password')}
                  title={t('auth:loginPage.demoAccount.copyPasswordTitle')}
                  aria-label={t('auth:loginPage.demoAccount.copyPasswordTitle')}
                  className="p-1 text-text-tertiary hover:text-text-primary rounded transition-colors"
                >
                  {copiedField === 'password' ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Nút Đăng nhập ngay → (Cơ chế 2: Bypass) */}
          <button
            type="button"
            onClick={handleBypassClick}
            disabled={isLoading}
            className="w-full h-9 rounded-radius-md bg-[#1C1B1A] text-[#F7F6F3] hover:bg-[#2E2C29] active:bg-[#141312] text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <span>{t('auth:loginPage.demoAccount.quickLogin')}</span>
          </button>
        </div>
      )}

      {/* Trigger — Pill / FAB (§B.5) */}
      <button
        ref={pillRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={t('auth:loginPage.demoAccount.openDemoLabel')}
        className={cn(
          'fixed z-40 bg-[#1C1B1A] text-[#F7F6F3] hover:bg-[#2E2C29] active:bg-[#141312] transition-colors shadow-sm',
          'bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] md:bottom-5 right-4 md:right-5',
          // Desktop ≥ md: pill ngang (height 36, padding-x 12, radius-full)
          // Mobile < md: FAB 36x36 icon-only, dot 6px góc trên phải
          'h-9 flex items-center justify-center rounded-radius-full',
          'w-9 md:w-auto md:px-3 md:gap-2',
        )}
      >
        {/* Dot xanh 6px */}
        <span className="hidden md:inline-block h-1.5 w-1.5 rounded-radius-full bg-[#2F6F44] shrink-0" />
        <FlaskConical className="h-3.5 w-3.5 md:h-3.5 md:w-3.5 text-white shrink-0" />
        <span className="hidden md:inline text-xs font-medium leading-none">
          Demo
        </span>
        {/* Dot mobile góc trên phải của FAB */}
        <span className="md:hidden absolute top-1 right-1 h-1.5 w-1.5 rounded-radius-full bg-[#2F6F44]" />
      </button>
    </>
  );
}
