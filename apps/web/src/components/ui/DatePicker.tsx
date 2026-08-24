import { useState, useRef, useEffect } from 'react';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  id?: string;
  value?: string; // Format: 'YYYY-MM-DD'
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  minDate?: string;
  position?: 'top' | 'bottom';
}

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
  'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
  'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

const WEEK_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function DatePicker({ id, value = '', onChange, placeholder = 'DD/MM/YYYY', className, position = 'top' }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMonthYearPickerOpen, setIsMonthYearPickerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse date value (YYYY-MM-DD)
  const parsedDate = value ? new Date(value + 'T00:00:00') : null;
  const today = new Date();

  const [currentYear, setCurrentYear] = useState(parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.getFullYear() : today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.getMonth() : today.getMonth());

  // Input text state for manual typing (DD/MM/YYYY)
  const [textInput, setTextInput] = useState(() => {
    if (parsedDate && !isNaN(parsedDate.getTime())) {
      const d = String(parsedDate.getDate()).padStart(2, '0');
      const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const y = parsedDate.getFullYear();
      return `${d}/${m}/${y}`;
    }
    return '';
  });

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsMonthYearPickerOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setCurrentYear(d.getFullYear());
        setCurrentMonth(d.getMonth());
        const dayStr = String(d.getDate()).padStart(2, '0');
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        setTextInput(`${dayStr}/${monthStr}/${d.getFullYear()}`);
      }
    } else {
      setTextInput('');
    }
  }, [value]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  // 0 (Chủ nhật) -> 6, 1 (T2) -> 0
  const startingDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const handleSelectDay = (day: number) => {
    const formattedMonth = String(currentMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleManualInput = (val: string) => {
    setTextInput(val);
    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(val.trim());
    if (ddmmyyyy) {
      const d = parseInt(ddmmyyyy[1], 10);
      const m = parseInt(ddmmyyyy[2], 10);
      const y = parseInt(ddmmyyyy[3], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
        const formatted = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        onChange(formatted);
        return;
      }
    }
    if (!val.trim()) {
      onChange('');
    }
  };

  const handleClear = () => {
    onChange('');
    setTextInput('');
    setIsOpen(false);
  };

  const handleToday = () => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };

  // Generate Year options
  const YEARS = Array.from({ length: 16 }, (_, i) => today.getFullYear() - 5 + i);

  const popoverPositionClass =
    position === 'top'
      ? 'bottom-full mb-1.5'
      : 'top-full mt-1.5';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Ô Input: Text thuần bên trái + icon lịch bên phải */}
      <div className="relative flex h-9 w-full items-center rounded-lg border border-slate-200 bg-white focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
        <input
          id={id}
          type="text"
          value={textInput}
          onChange={(e) => handleManualInput(e.target.value)}
          placeholder={placeholder}
          className="h-full w-full rounded-l-lg bg-transparent pl-3 pr-2 text-xs font-medium text-slate-800 outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Mở bảng chọn lịch"
          className={cn(
            'flex h-full items-center justify-center border-l border-slate-200 px-2.5 text-slate-400 hover:bg-slate-50 hover:text-primary-600 transition-colors cursor-pointer rounded-r-lg',
            isOpen ? 'bg-primary-50 text-primary-600' : ''
          )}
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Popover Calendar Card mở lên PHÍA TRÊN, thiết kế siêu gọn gàng không chạm Header */}
      {isOpen && (
        <div
          className={cn(
            'absolute left-0 z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-400/30 animate-slide-up select-none flex flex-col justify-between',
            popoverPositionClass
          )}
        >
          <div>
            {/* Header: Tháng & Năm + Mũi tên Next/Prev */}
            <div className="flex items-center justify-between mb-2 px-0.5">
              <button
                type="button"
                onClick={() => setIsMonthYearPickerOpen(!isMonthYearPickerOpen)}
                className="flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-bold text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span>{MONTH_NAMES[currentMonth]} {currentYear}</span>
                <span className="text-[8px] text-slate-400">▼</span>
              </button>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  title="Tháng trước"
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronLeftIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  title="Tháng sau"
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Màn hình chọn nhanh Tháng & Năm */}
            {isMonthYearPickerOpen ? (
              <div className="space-y-2 py-1">
                <div>
                  <span className="block text-[10px] font-semibold text-slate-400 mb-1">Chọn tháng</span>
                  <div className="grid grid-cols-4 gap-1">
                    {MONTH_NAMES.map((m, idx) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setCurrentMonth(idx);
                          setIsMonthYearPickerOpen(false);
                        }}
                        className={cn(
                          'rounded-md py-1 text-[10px] font-semibold transition-colors cursor-pointer',
                          currentMonth === idx ? 'bg-primary-600 text-white' : 'hover:bg-slate-100 text-slate-700'
                        )}
                      >
                        {m.replace('Tháng ', 'T')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-semibold text-slate-400 mb-1">Chọn năm</span>
                  <div className="grid grid-cols-4 gap-1 max-h-20 overflow-y-auto pr-1">
                    {YEARS.map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => {
                          setCurrentYear(y);
                          setIsMonthYearPickerOpen(false);
                        }}
                        className={cn(
                          'rounded-md py-0.5 text-[10px] font-semibold transition-colors cursor-pointer',
                          currentYear === y ? 'bg-primary-600 text-white' : 'hover:bg-slate-100 text-slate-700'
                        )}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Thứ trong tuần */}
                <div className="grid grid-cols-7 gap-0.5 text-center mb-0.5">
                  {WEEK_DAYS.map((wd) => (
                    <span key={wd} className="text-[9px] font-bold text-slate-400">
                      {wd}
                    </span>
                  ))}
                </div>

                {/* Lưới các ngày */}
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {/* Ngày tháng trước */}
                  {Array.from({ length: startingDayIndex }).map((_, i) => {
                    const day = daysInPrevMonth - startingDayIndex + i + 1;
                    return (
                      <span key={`prev-${i}`} className="flex h-5.5 items-center justify-center text-[10px] text-slate-300 select-none">
                        {day}
                      </span>
                    );
                  })}

                  {/* Ngày tháng hiện tại */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isSelected =
                      parsedDate &&
                      !isNaN(parsedDate.getTime()) &&
                      parsedDate.getFullYear() === currentYear &&
                      parsedDate.getMonth() === currentMonth &&
                      parsedDate.getDate() === day;

                    const isToday =
                      today.getFullYear() === currentYear &&
                      today.getMonth() === currentMonth &&
                      today.getDate() === day;

                    return (
                      <button
                        key={`cur-${day}`}
                        type="button"
                        onClick={() => handleSelectDay(day)}
                        className={cn(
                          'flex h-5.5 w-full items-center justify-center rounded text-[10px] font-semibold transition-all duration-150 cursor-pointer',
                          isSelected
                            ? 'bg-slate-800 text-white font-bold shadow-xs'
                            : isToday
                              ? 'bg-primary-50 text-primary-700 font-bold border border-primary-300 hover:bg-primary-100'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}

                  {/* Ngày tháng sau */}
                  {Array.from({ length: Math.max(0, 42 - (startingDayIndex + daysInMonth)) }).map((_, i) => {
                    const day = i + 1;
                    return (
                      <span key={`next-${i}`} className="flex h-5.5 items-center justify-center text-[10px] text-slate-300 select-none">
                        {day}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Quick Action Footer: Clear & Today */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 mt-1 px-1 shrink-0">
            <button
              type="button"
              onClick={handleClear}
              className="text-[10px] font-semibold text-primary-600 hover:text-primary-700 transition-colors cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="text-[10px] font-semibold text-primary-600 hover:text-primary-700 transition-colors cursor-pointer"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
