import { memo, useState } from 'react';
import { cn, getInitials, stringToColorClass } from '@/lib/utils';

interface AvatarProps {
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  // 26/10/2026: anh dai dien that (presigned URL TTL ngan tu IAM, Technical_Spec.md muc 27.5). URL het
  // han/loi tai -> tu quay ve chu viet tat (danh sach lam moi se cap URL moi).
  src?: string | null;
}

const sizeClasses = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-11 w-11 text-sm',
};

export const Avatar = memo(function Avatar({ name, size = 'md', className, src }: AvatarProps) {
  const hasCustomBg = className && /(^|\s)bg-/.test(className);
  const hasCustomText = className && /(^|\s)text-/.test(className);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src && failedSrc !== src) {
    return (
      <img
        src={src}
        alt={name ?? ''}
        title={name}
        onError={() => setFailedSrc(src)}
        className={cn('inline-block shrink-0 rounded-full object-cover', sizeClasses[size], className)}
      />
    );
  }

  return (
    <span
      title={name}
      // 28/07/2026: them aria-label={name} (phat hien qua ra soat kha nang tiep can) - truoc do
      // danh tinh nguoi dung chi duoc the hien qua title (tooltip khi ru chuot, khong the tiep can
      // bang ban phim) va noi dung duy nhat trinh doc man hinh doc duoc la 1-2 chu cai viet tat; vi
      // du tren the Kanban (TaskCard qua AvatarStack), ten nguoi phu trach khong xuat hien o dau khac.
      aria-label={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        !hasCustomText && 'text-white',
        sizeClasses[size],
        !hasCustomBg && stringToColorClass(name || '?'),
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
});

export const AvatarStack = memo(function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} size="sm" className="ring-2 ring-white" />
      ))}
      {extra > 0 && (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 ring-2 ring-white">
          +{extra}
        </span>
      )}
    </div>
  );
});

