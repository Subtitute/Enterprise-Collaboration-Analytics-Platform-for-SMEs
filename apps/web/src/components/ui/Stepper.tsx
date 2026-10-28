import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { CheckIcon } from '@/components/ui/Icons';

export interface StepItem {
  id: number;
  label: string;
}

interface StepperProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
  className?: string;
  'aria-label'?: string;
}

/**
 * Stepper Component (Design System v0.3)
 * - >= md: Cấu trúc ngang: circle 28x28 + label bên dưới căn giữa + đường nối 1px.
 * - < md: Text mode: "Bước {n} / {total} · {label}" + progress bar 4px.
 * - Tương tác: Chỉ step "Done" mới clickable. "Current" và "Upcoming" không clickable.
 */
export const Stepper = memo(function Stepper({
  steps,
  currentStep,
  onStepClick,
  className,
  'aria-label': ariaLabel,
}: StepperProps) {
  const { t } = useTranslation();
  const currentStepItem = steps.find((s) => s.id === currentStep) || steps[0];
  const progressPercent = Math.min(100, Math.max(0, (currentStep / steps.length) * 100));

  // 28/10/2026 (merge Frontend2): khoang cach duoi mb-10 -> mb-6 de form Dang ky gon hon tren man hinh thap.
  return (
    <div className={cn('w-full max-w-[420px] mx-auto mb-6', className)} aria-label={ariaLabel || t('common:stepper.ariaLabel')}>
      {/* =========================================================================
          MOBILE VIEW (< md): Text mode + progress bar 4px (§2.5)
          ========================================================================= */}
      <div className="flex flex-col md:hidden w-full">
        <div className="text-[13px] leading-5 text-text-secondary text-center font-medium mb-2">
          {t('common:stepper.mobileLabel', { current: currentStep, total: steps.length, label: currentStepItem?.label })}
        </div>
        <div className="h-1 w-full bg-[#E5E7EB] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0E5E5E] transition-all duration-300 ease-in-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* =========================================================================
          DESKTOP VIEW (>= md): Horizontal Indicator Circles + Connecting Lines (§2.1, §2.2)
          ========================================================================= */}
      <div className="hidden md:flex items-start justify-between relative w-full">
        {steps.map((step, idx) => {
          // Spec §5.1: Ở Step 3 (Hoàn tất), cả 3 step = Done, đường nối teal toàn bộ
          const isDone = currentStep === steps.length ? true : step.id < currentStep;
          const isCurrent = currentStep === steps.length ? false : step.id === currentStep;
          const isUpcoming = currentStep === steps.length ? false : step.id > currentStep;
          const isLast = idx === steps.length - 1;

          // Trạng thái đường nối phía sau step hiện tại (kéo dài tới step kế tiếp)
          const nextStep = steps[idx + 1];
          const isConnectingLineActive = currentStep === steps.length ? true : (nextStep ? nextStep.id <= currentStep : false);

          return (
            <div
              key={step.id}
              className="relative flex flex-col items-center flex-1 max-w-[140px]"
            >
              {/* Đường nối sang step kế tiếp: nằm chính giữa các circle (top 14px) */}
              {!isLast && (
                <div
                  className={cn(
                    'absolute top-[14px] left-[50%] w-full h-[1px] -z-0 transition-colors duration-200',
                    isConnectingLineActive ? 'bg-[#0E5E5E]' : 'bg-[#E5E7EB]',
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Circle indicator 28x28 */}
              <button
                type="button"
                disabled={!isDone}
                onClick={() => {
                  if (isDone && onStepClick) {
                    onStepClick(step.id);
                  }
                }}
                aria-label={t('common:stepper.stepAriaLabel', {
                  id: step.id,
                  label: step.label,
                  status: isDone
                    ? t('common:stepper.status.done')
                    : isCurrent
                    ? t('common:stepper.status.current')
                    : t('common:stepper.status.upcoming'),
                })}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'relative z-10 w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-150',
                  isDone && 'bg-[#0E5E5E] text-white hover:bg-[#0c4e4e] cursor-pointer shadow-xs',
                  isCurrent && 'bg-white border-2 border-[#0E5E5E] text-[#0E5E5E] cursor-default font-semibold',
                  isUpcoming && 'bg-white border border-[#D1D5DB] text-text-tertiary cursor-default font-medium',
                )}
              >
                {isDone ? (
                  <CheckIcon className="w-3.5 h-3.5 stroke-[2] text-white" />
                ) : (
                  <span className="text-xs font-semibold leading-none">{step.id}</span>
                )}
              </button>

              {/* Label căn giữa, max-width 120px, font 12/16 */}
              <span
                className={cn(
                  'mt-2 text-xs leading-4 text-center max-w-[120px] transition-colors',
                  isDone && 'text-text-primary font-medium',
                  isCurrent && 'text-text-primary font-semibold',
                  isUpcoming && 'text-text-tertiary font-medium',
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

