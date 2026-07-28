import { cloneElement, forwardRef, isValidElement, useId } from 'react';
import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const fieldBase =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50 disabled:text-slate-400';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, className)} {...props} />
));
Input.displayName = 'Input';

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
