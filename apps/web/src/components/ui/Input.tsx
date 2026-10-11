import { cloneElement, forwardRef, isValidElement, useId, useState } from 'react';
import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn, containsVietnameseDiacritics } from '@/lib/utils';
import { AlertCircleIcon, EyeIcon, EyeOffIcon, ChevronDownIcon } from './Icons';

const fieldBase =
  'block w-full h-9 rounded-radius-sm border border-border-strong bg-white px-3 py-2 text-sm leading-[22px] text-text-primary placeholder:text-text-tertiary ' +
  'transition-colors duration-150 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft disabled:bg-bg-muted disabled:text-text-tertiary disabled:cursor-not-allowed';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, className)} {...props} />
));
Input.displayName = 'Input';

// 20/08/2026: sua loi thuc te - nut "hien mat khau" nguoi dung thay tren man hinh dang nhap KHONG
// phai do app nay ve, ma la nut "reveal password" GAN SAN cua trinh duyet (Edge/Chromium) tren
// input[type=password] - trinh duyet quan ly rieng, doc lap voi React, nen doi khi mat dong bo
// voi gia tri controlled cua React (bam ra ngoai xong nut ngung phan hoi, phai xoa go lai het moi
// het "ket dinh") - loi nay nam ngoai code cua du an, khong the sua truc tiep. Giai phap: tu ve
// nut hien/an rieng (React state, khong phu thuoc hanh vi noi bo trinh duyet nao ca) + an nut co
// san cua Edge di (`::-ms-reveal`/`::-ms-clear`, xem index.css) de khong bi CHONG 2 nut cung luc.
// 20/08/2026: canh bao (KHONG chan) khi phat hien dau tieng Viet trong mat khau - nguyen nhan
// thuc te thuong gap la bo go Unikey/EVKey tu dong ghep dau trong luc go, ma o mat khau CHE ky
// tu nen nguoi dung khong co cach nao tu nhan ra minh vua go nham. Chi hien thi 1 dong canh bao
// nho, KHONG loc/chan ky tu - han che bo ky tu cho phep trong mat khau lam giam do manh mat khau,
// di nguoc muc tieu bao mat that su. Xem containsVietnameseDiacritics() trong lib/utils.ts.
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { leftIcon?: ReactNode }>(
  ({ className, value, leftIcon, ...props }, ref) => {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative w-full">
        {leftIcon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 z-10 text-text-tertiary">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn(fieldBase, leftIcon ? 'pl-9 pr-9' : 'pr-9', className)}
          value={value}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('common:password.hide') : t('common:password.show')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-text-tertiary hover:text-text-secondary transition-colors"
        >
          {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, 'h-auto min-h-[80px] resize-y py-2', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <div className="relative w-full">
    <select
      ref={ref}
      className={cn(
        fieldBase,
        'appearance-none pr-9 text-text-primary bg-white cursor-pointer transition-colors hover:border-border-strong focus:border-accent focus-visible:ring-accent-soft',
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary">
      <ChevronDownIcon className="h-4 w-4" />
    </div>
  </div>
));
Select.displayName = 'Select';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-[13px] leading-5 font-medium text-text-secondary', className)} {...props} />;
}

interface FormFieldProps {
  label?: ReactNode;
  htmlFor?: string;
  error?: string;
  warning?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  reserveMessageSpace?: boolean;
}

// 28/07/2026: gan aria-describedby/aria-invalid cho control con + role="alert" cho dong loi (phat
// hien qua ra soat kha nang tiep can) - truoc do thong bao loi chi la 1 <p> hien thi truc quan,
// khong co lien ket ky thuat nao voi control cua no va khong duoc cong bo boi trinh doc man hinh
// khi xuat hien; nguoi dung submit form loi se KHONG nghe thay gi ca. Sua tap trung tai day (thay
// vi sua tung noi dang dung FormField) bang cach clone phan tu con (Input/Select/Textarea) de gan
// them 2 thuoc tinh ARIA, chi khi children la 1 phan tu hop le (dung 100% cac cach dung hien co).
export function FormField({
  label,
  htmlFor,
  error,
  warning,
  hint,
  required,
  children,
  className,
  reserveMessageSpace = true,
}: FormFieldProps) {
  const generatedId = useId();
  const messageId = htmlFor ? `${htmlFor}-message` : generatedId;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || warning || hint ? messageId : undefined,
      })
    : children;

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </Label>
      )}
      {control}
      {reserveMessageSpace ? (
        <div className="field-message min-h-[18px] mt-1 flex items-start" id={messageId}>
          {error ? (
            <p role="alert" aria-live="polite" className="text-xs leading-4 text-error transition-opacity duration-120">
              {error}
            </p>
          ) : warning ? (
            <p role="status" aria-live="polite" className="text-xs leading-4 text-warning flex items-center gap-1 transition-opacity duration-120">
              <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{warning}</span>
            </p>
          ) : hint ? (
            <p className="text-xs leading-4 text-text-tertiary">
              {hint}
            </p>
          ) : null}
        </div>
      ) : error ? (
        <p id={messageId} role="alert" aria-live="polite" className="mt-1 text-xs leading-4 text-error">
          {error}
        </p>
      ) : warning ? (
        <p id={messageId} role="status" aria-live="polite" className="mt-1 text-xs leading-4 text-warning flex items-center gap-1">
          <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" />
          <span>{warning}</span>
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1 text-xs leading-4 text-text-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn(
      'h-4 w-4 rounded-radius-xs border-border-strong text-text-primary accent-[#1C1B1A] focus:ring-2 focus:ring-accent-soft focus:ring-offset-0 transition-colors cursor-pointer',
      className,
    )}
    {...props}
  />
));
Checkbox.displayName = 'Checkbox';

export const Radio = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="radio"
    className={cn(
      'h-4 w-4 rounded-radius-full border-border-strong text-text-primary accent-[#1C1B1A] focus:ring-2 focus:ring-accent-soft focus:ring-offset-0 transition-colors cursor-pointer',
      className,
    )}
    {...props}
  />
));
Radio.displayName = 'Radio';
