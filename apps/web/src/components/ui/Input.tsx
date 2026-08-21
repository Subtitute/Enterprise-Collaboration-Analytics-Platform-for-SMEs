import { cloneElement, forwardRef, isValidElement, useId, useState } from 'react';
import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn, containsVietnameseDiacritics } from '@/lib/utils';
import { AlertCircleIcon, EyeIcon, EyeOffIcon } from './Icons';

const fieldBase =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50 disabled:text-slate-400';

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
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, value, ...props }, ref) => {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const hasDiacritics = typeof value === 'string' && containsVietnameseDiacritics(value);
    return (
      <div>
        <div className="relative">
          <input
            ref={ref}
            type={visible ? 'text' : 'password'}
            className={cn(fieldBase, 'pr-9', className)}
            value={value}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? t('common:password.hide') : t('common:password.show')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
          >
            {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        </div>
        {hasDiacritics && (
          <p role="status" aria-live="polite" className="mt-1 flex items-center gap-1 text-xs text-amber-600">
            <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" />
            {t('common:password.diacriticsWarning')}
          </p>
        )}
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(fieldBase, 'min-h-[88px] resize-y', className)} {...props} />,
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(fieldBase, 'pr-8', className)} {...props}>
    {children}
  </select>
));
Select.displayName = 'Select';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-medium text-slate-700', className)} {...props} />;
}

interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

// 28/07/2026: gan aria-describedby/aria-invalid cho control con + role="alert" cho dong loi (phat
// hien qua ra soat kha nang tiep can) - truoc do thong bao loi chi la 1 <p> hien thi truc quan,
// khong co lien ket ky thuat nao voi control cua no va khong duoc cong bo boi trinh doc man hinh
// khi xuat hien; nguoi dung submit form loi se KHONG nghe thay gi ca. Sua tap trung tai day (thay
// vi sua tung noi dang dung FormField) bang cach clone phan tu con (Input/Select/Textarea) de gan
// them 2 thuoc tinh ARIA, chi khi children la 1 phan tu hop le (dung 100% cac cach dung hien co).
export function FormField({ label, htmlFor, error, hint, required, children, className }: FormFieldProps) {
  const generatedId = useId();
  const messageId = htmlFor ? `${htmlFor}-message` : generatedId;
  const hasMessage = Boolean(error || hint);

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        'aria-invalid': error ? true : undefined,
        'aria-describedby': hasMessage ? messageId : undefined,
      })
    : children;

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </Label>
      )}
      {control}
      {error ? (
        <p id={messageId} role="alert" className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1 text-xs text-slate-400">
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
      'h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-2 focus:ring-primary-100 focus:ring-offset-0',
      className,
    )}
    {...props}
  />
));
Checkbox.displayName = 'Checkbox';
