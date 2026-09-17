import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClockIcon, CheckIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  id?: string;
  value?: string; // 'HH:mm'
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  align?: 'left' | 'right';
  position?: 'top' | 'bottom';
  required?: boolean;
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
}: TimePickerProps) {
  const { t } = useTranslation();
  const errorId = useId();

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

  // Tạo danh sách 24 giờ và các mốc phút (cách nhau 5 phút, hoặc chọn tự do)
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10, ... 55

  // Quick preset shortcuts
  const PRESETS = [
    { label: '08:00', value: '08:00' },
    { label: '08:30', value: '08:30' },
    { label: '12:00', value: '12:00' },
    { label: '13:30', value: '13:30' },
    { label: '17:30', value: '17:30' },
    { label: '18:00', value: '18:00' },
  ];

  const popoverPositionClass = position === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5';
  const popoverAlignClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input container: text bên trái, icon đồng hồ bên phải */}
      <div className="relative flex h-9 w-full items-center rounded-lg border border-slate-300 bg-white transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
        <input
          id={id}
          type="text"
          value={textInput}
          onChange={(e) => handleManualInput(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="h-full w-full rounded-l-lg bg-transparent pl-3 pr-2 text-xs font-mono font-medium text-slate-800 outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          title={t('common:timePicker.openTitle', 'Chọn thời gian')}
          className={cn(
            'flex h-full items-center justify-center border-l border-slate-200 px-2.5 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer rounded-r-lg',
            isOpen ? 'bg-indigo-50 text-indigo-600' : ''
          )}
        >
          <ClockIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Popover Card chọn Giờ & Phút phong cách Indigo/Violet chuẩn của dự án */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 w-64 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xl shadow-slate-900/10 animate-slide-up select-none flex flex-col gap-2.5',
            popoverAlignClass,
            popoverPositionClass
          )}
        >
          {/* Header hiển thị giờ đang chọn */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1">
            <span className="text-xs font-semibold text-slate-500">{t('common:timePicker.title', 'Chọn mốc giờ')}</span>
            <span className="font-mono text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}
            </span>
          </div>

          {/* Cột 2 trục: Cột Giờ & Cột Phút */}
          <div className="grid grid-cols-2 gap-2">
            {/* Cột Giờ (00 - 23) */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 text-center">
                {t('common:timePicker.hours', 'Giờ')}
              </span>
              <div
                ref={hoursListRef}
                className="h-36 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-1 space-y-0.5 text-center text-xs"
              >
                {HOURS.map((h) => {
                  const isSel = h === selectedHour;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleSelectHour(h)}
                      className={cn(
                        'w-full py-1 rounded-lg font-mono font-semibold transition-all cursor-pointer text-xs flex items-center justify-center gap-1',
                        isSel
                          ? 'bg-indigo-600 text-white font-bold shadow-xs shadow-indigo-600/30'
                          : 'text-slate-600 hover:bg-white hover:text-slate-900'
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
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 text-center">
                {t('common:timePicker.minutes', 'Phút')}
              </span>
              <div
                ref={minutesListRef}
                className="h-36 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-1 space-y-0.5 text-center text-xs"
              >
                {MINUTES.map((m) => {
                  const isSel = Math.abs(m - selectedMinute) < 3; // Gần với mốc 5 phút
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectMinute(m)}
                      className={cn(
                        'w-full py-1 rounded-lg font-mono font-semibold transition-all cursor-pointer text-xs flex items-center justify-center gap-1',
                        isSel
                          ? 'bg-indigo-600 text-white font-bold shadow-xs shadow-indigo-600/30'
                          : 'text-slate-600 hover:bg-white hover:text-slate-900'
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
          <div className="border-t border-slate-100 pt-2">
            <span className="text-[10px] font-medium text-slate-400 block mb-1">
              {t('common:timePicker.presets', 'Mốc nhanh:')}
            </span>
            <div className="grid grid-cols-3 gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    setTextInput(p.value);
                    onChange(p.value);
                  }}
                  className={cn(
                    'py-1 px-1.5 text-[11px] font-mono rounded-lg border text-center transition-colors cursor-pointer',
                    value === p.value
                      ? 'bg-indigo-50 text-indigo-700 font-bold border-indigo-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
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
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              <CheckIcon className="h-3 w-3" />
              <span>{t('common:actions.done', 'Xong')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

