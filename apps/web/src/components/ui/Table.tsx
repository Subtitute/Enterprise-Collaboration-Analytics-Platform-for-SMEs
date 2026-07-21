import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Duoi 768px (mobile), bang chuyen sang dang "card list" thay vi cuon ngang (Wireframe.md muc 10):
// <thead> an di, moi <tr> tro thanh mot the (card) rieng voi vien bo tron, moi <td> hien them
// mot nhan cot (label) phia tren gia tri cua no thong qua data-label + CSS content: attr(...)
// (xem TableCell) - dung Tailwind "max-md:" (built-in tu v3.4) de khong phai tao component
// "card" rieng cho tung trang dung Table nay (FileTable, MembersPage, DepartmentsPage,
// ProjectProgressTable... deu duoc huong tu dong).
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white md:overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm max-md:block md:min-w-[560px]', className)} {...props} />
    </div>
  );
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-slate-50 text-left max-md:hidden', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('divide-y divide-slate-100 max-md:block max-md:space-y-2.5 max-md:divide-y-0 max-md:p-2.5', className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'hover:bg-slate-50/70 max-md:block max-md:rounded-lg max-md:border max-md:border-slate-200 max-md:p-3 max-md:shadow-sm max-md:hover:bg-transparent',
        className,
      )}
      {...props}
    />
  );
}

export function TableHeadCell({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500', className)}
      {...props}
    />
  );
}

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  /** Nhan cot hien phia tren gia tri khi o che do card-list (mobile) - truyen giong text cua
   *  TableHeadCell tuong ung. Bo qua neu khong can nhan (vd cot hanh dong chi co 1 nut). */
  label?: string;
}

export function TableCell({ className, label, ...props }: TableCellProps) {
  return (
    <td
      data-label={label}
      className={cn(
        'px-4 py-3 align-middle text-slate-700',
        'max-md:block max-md:px-0 max-md:py-1.5 max-md:first:pt-0 max-md:last:pb-0',
        label &&
          'max-md:before:mb-0.5 max-md:before:block max-md:before:text-[11px] max-md:before:font-semibold max-md:before:uppercase max-md:before:tracking-wide max-md:before:text-slate-400 max-md:before:content-[attr(data-label)]',
        className,
      )}
      {...props}
    />
  );
}
