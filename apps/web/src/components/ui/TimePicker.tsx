import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClockIcon, CheckIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

export interface TimePreset {
  label: string;
  value: string;
}

// Danh sách 24 giờ và các mốc phút (cách nhau 5 phút) - hằng số tĩnh tránh khởi tạo lại mỗi render
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10, ... 55

// Default quick preset shortcuts
const DEFAULT_PRESETS: TimePreset[] = [
  { label: '08:00', value: '08:00' },
  { label: '08:30', value: '08:30' },
  { label: '12:00', value: '12:00' },
  { label: '13:30', value: '13:30' },
  { label: '17:30', value: '17:30' },
  { label: '18:00', value: '18:00' },
];

interface TimePickerProps {
  id?: string;
  value?: string; // 'HH:mm'
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  align?: 'left' | 'right';
  position?: 'top' | 'bottom';
  required?: boolean;
  presets?: TimePreset[];
}

export function TimePicker({
  id,
  value = '08:30',
  onChange,
  placeholder = 'HH:mm',
  className,
  align = 'left',
  position = 'bottom',
  required,
  presets,
}: TimePickerProps) {
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const hoursListRef = useRef<HTMLDivElement>(null);
  const minutesListRef = useRef<HTMLDivElement>(null);

  // Phân tích giá trị HH:mm hiện tại
  const [currentHourStr, currentMinuteStr] = (value && value.includes(':') ? value.split(':') : ['08', '30']).map((s) => s.trim());
  const selectedHour = Math.min(23, Math.max(0, parseInt(currentHourStr, 10) || 0));
  const selectedMinute = Math.min(59, Math.max(0, parseInt(currentMinuteStr, 10) || 0));

  const [textInput, setTextInput] = useState(value || '');

  useEffect(() => {
    setTextInput(value || '');
  }, [value]);

  // Cuộn đến giờ và phút được chọn khi mở popover
  useEffect(() => {
    if (isOpen) {
      if (hoursListRef.current) {
        const item = hoursListRef.current.children[selectedHour] as HTMLElement;
        if (item) {
          hoursListRef.current.scrollTop = item.offsetTop - 40;
        }
      }
      if (minutesListRef.current) {
        // Mỗi nấc phút (bước nhảy 5 phút hoặc 60 phút)
        const minuteIndex = Math.floor(selectedMinute / 5);
        const item = minutesListRef.current.children[minuteIndex] as HTMLElement;
        if (item) {
          minutesListRef.current.scrollTop = item.offsetTop - 40;
        }
      }
    }
  }, [isOpen, selectedHour, selectedMinute]);

  // Đóng khi click ngoài hoặc ấn phím Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Xử lý khi người dùng nhập thủ công trên bàn phím
  const handleManualInput = (raw: string) => {
    setTextInput(raw);
    const timeMatch = raw.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/);
    if (timeMatch) {
      const h = String(parseInt(timeMatch[1], 10)).padStart(2, '0');
      const m = timeMatch[2];
      onChange(`${h}:${m}`);
    }
  };

  const handleSelectHour = (h: number) => {
    const newH = String(h).padStart(2, '0');
    const newM = String(selectedMinute).padStart(2, '0');
    const val = `${newH}:${newM}`;
    setTextInput(val);
    onChange(val);
  };

  const handleSelectMinute = (m: number) => {
    const newH = String(selectedHour).padStart(2, '0');
    const newM = String(m).padStart(2, '0');
    const val = `${newH}:${newM}`;
    setTextInput(val);
    onChange(val);
  };

  const activePresets = presets && presets.length > 0 ? presets : DEFAULT_PRESETS;


  const popoverPositionClass = position === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5';
  const popoverAlignClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input container: text bên trái, icon đồng hồ bên phải (§2.3) */}
      <div className="relative flex h-9 w-full items-center rounded-radius-sm border border-border-strong bg-white transition-all focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        <input
          id={id}
          type="text"
          value={textInput}
          onChange={(e) => handleManualInput(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="h-full w-full rounded-l-radius-sm bg-transparent pl-3 pr-2 font-mono text-[13px] leading-[20px] font-medium text-text-primary outline-none placeholder:font-mono placeholder:text-[13px] placeholder:font-normal placeholder:text-text-tertiary tabular-nums"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          title={t('common:timePicker.openTitle')}
          className={cn(
            'flex h-full items-center justify-center border-l border-border-subtle px-2.5 text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer rounded-r-radius-sm',
            isOpen ? 'bg-bg-subtle text-text-primary' : ''
          )}
        >
          <ClockIcon className="h-4 w-4 stroke-[1.5]" />
        </button>
      </div>

      {/* Popover Card chọn Giờ & Phút phong cách phẳng / Teal / Ink chuẩn Design System */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 w-60 rounded-radius-md border border-border-subtle bg-white p-2.5 shadow-md animate-slide-up select-none flex flex-col gap-2',
            popoverAlignClass,
            popoverPositionClass
          )}
        >
          {/* Header hiển thị giờ đang chọn */}
          <div className="flex items-center justify-between border-b border-border-subtle pb-1.5 px-0.5">
            <span className="text-[11px] font-semibold text-text-secondary">{t('common:timePicker.title')}</span>
            <span className="font-mono text-xs font-semibold text-accent bg-accent-soft px-2 py-0.5 rounded-radius-xs tabular-nums">
              {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}
            </span>
          </div>

          {/* Cột 2 trục: Cột Giờ & Cột Phút */}
          <div className="grid grid-cols-2 gap-2">
            {/* Cột Giờ (00 - 23) */}
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1 text-center">
                {t('common:timePicker.hours')}
              </span>
              <div
                ref={hoursListRef}
                className="h-32 overflow-y-auto rounded-radius-sm border border-border-subtle bg-bg-subtle/50 p-1 space-y-0.5 text-center text-xs popover-scrollbar"
              >
                {HOURS.map((h) => {
                  const isSel = h === selectedHour;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleSelectHour(h)}
                      className={cn(
                        'w-full py-1 rounded-radius-xs font-mono font-medium transition-colors cursor-pointer text-xs flex items-center justify-center tabular-nums',
                        isSel
                          ? 'bg-[#0E5E5E] text-white font-semibold shadow-none'
                          : 'text-text-secondary hover:bg-white hover:text-text-primary'
                      )}
                    >
                      <span>{String(h).padStart(2, '0')}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cột Phút (00, 05, 10 ... 55) */}
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1 text-center">
                {t('common:timePicker.minutes')}
              </span>
              <div
                ref={minutesListRef}
                className="h-32 overflow-y-auto rounded-radius-sm border border-border-subtle bg-bg-subtle/50 p-1 space-y-0.5 text-center text-xs popover-scrollbar"
              >
                {MINUTES.map((m) => {
                  const isSel = Math.abs(m - selectedMinute) < 3; // Gần với mốc 5 phút
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectMinute(m)}
                      className={cn(
                        'w-full py-1 rounded-radius-xs font-mono font-medium transition-colors cursor-pointer text-xs flex items-center justify-center tabular-nums',
                        isSel
                          ? 'bg-[#0E5E5E] text-white font-semibold shadow-none'
                          : 'text-text-secondary hover:bg-white hover:text-text-primary'
                      )}
                    >
                      <span>{String(m).padStart(2, '0')}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mốc chọn nhanh (Presets) */}
          <div className="border-t border-border-subtle pt-1.5">
            <span className="text-[10px] font-medium text-text-tertiary block mb-1">
              {t('common:timePicker.presets')}
            </span>
            <div className="grid grid-cols-3 gap-1">
              {activePresets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    setTextInput(p.value);
                    onChange(p.value);
                  }}
                  className={cn(
                    'py-1 px-1.5 text-[11px] font-mono rounded-radius-xs border text-center transition-colors cursor-pointer tabular-nums',
                    value === p.value
                      ? 'bg-accent-soft text-accent font-semibold border-accent/30'
                      : 'bg-white text-text-secondary border-border-subtle hover:bg-bg-subtle hover:text-text-primary'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Footer nút Đóng / Xác nhận */}
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-radius-sm bg-text-primary hover:bg-[#2E2C29] text-white text-xs font-medium cursor-pointer transition-colors"
            >
              <CheckIcon className="h-3 w-3 stroke-[2]" />
              <span>{t('common:actions.done', 'Xong')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

