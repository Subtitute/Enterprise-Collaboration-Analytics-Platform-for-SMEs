import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  id?: string;
  value?: string; // Format: 'YYYY-MM-DD'
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  /** 15/09/2026 (fix loi thuc te): chan chon ngay < minDate (chuoi 'YYYY-MM-DD', so sanh dang
   *  chuoi la du chinh xac vi da co dang zero-pad co dinh, khong can parse Date). Prop nay TUNG khai
   *  bao san trong type nhung KHONG duoc dung o dau trong than component - moi noi goi DatePicker
   *  (vd NewLeaveRequestModal.tsx) truyen minDate tuong nhu co tac dung nhung thuc te bi bo qua hoan
   *  toan, dan tuc lich su phat hien tu ke chi cua khach hang: chon 1 ngay nghi phep trong QUA KHU
   *  van tao duoc yeu cau. Nay da lien ket that voi luoi ngay + input go tay. */
  minDate?: string;
  position?: 'top' | 'bottom';
  align?: 'left' | 'right';
}

export function DatePicker({
  id,
  value = '',
  onChange,
  placeholder,
  className,
  minDate,
  position = 'top',
  align = 'left',
}: DatePickerProps) {
  const { t } = useTranslation();
  const errorId = useId();

  // 26/08/2026: Fix 1 - chuyen ten thang/thu sang i18n (common:datePicker.months/monthsShort/
  // weekDays) thay vi hang so tieng Viet co dinh o dau file nhu truoc - DatePicker la noi DUY NHAT
  // trong app con sot van ban tieng Viet cung du nguoi dung da chon ngon ngu khac (en/ja) o moi
  // noi khac trong ung dung. Dung object voi khoa la chi so (0-11/0-6) thay vi mang JSON +
  // `t(key, {returnObjects:true})` de t() luon tra ve string don gian, dung quy uoc i18next hien
  // co trong toan repo (chua noi nao dung returnObjects truoc do).
  const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => t(`common:datePicker.months.${i}`));
  const MONTH_NAMES_SHORT = Array.from({ length: 12 }, (_, i) => t(`common:datePicker.monthsShort.${i}`));
  const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => t(`common:datePicker.weekDays.${i}`));
  // 26/08/2026: placeholder mac dinh chuyen vao i18n (common:datePicker.placeholder) - GIU NGUYEN
  // dinh dang "DD/MM/YYYY" cho ca 3 ngon ngu (khong doi thanh YYYY/MM/DD cho tieng Nhat) de nhat
  // quan voi quyet dinh da ghi trong lib/utils.ts (formatDate dung 'en-GB' thay vi 'en-US' - GIU
  // NGUYEN thu tu ngay/thang bat ke ngon ngu, tranh nham lan khi nguoi dung chuyen doi ngon ngu).
  const effectivePlaceholder = placeholder ?? t('common:datePicker.placeholder');

  const [isOpen, setIsOpen] = useState(false);
  const [isMonthYearPickerOpen, setIsMonthYearPickerOpen] = useState(false);
  // 26/08/2026: Fix 2 - trang thai bao "chuoi da nhap dung dinh dang dd/mm/yyyy nhung ngay khong
  // ton tai thuc te" (vd 31/02/2026) - component truoc day khong co bat ky trang thai loi nao cho
  // input nhap tay.
  const [inputError, setInputError] = useState(false);
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

  // 26/08/2026: Fix 3 - bo sung dong bang phim Escape (gop chung voi effect dong khi click ra
  // ngoai co san) - truoc ban sua nay popover chi dong duoc bang click ra ngoai, KHONG co phim tat
  // Escape nhu Dropdown.tsx/Modal.tsx da lam cho cac popover/dialog khac trong repo, nen nguoi dung
  // dieu huong bang ban phim khong co cach nao dong nhanh popover nay.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsMonthYearPickerOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsMonthYearPickerOpen(false);
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
    setInputError(false);
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
    // 15/09/2026: phong thu - nut ngay bi disabled da chan click qua thuoc tinh `disabled`, nhung
    // kiem tra lai o day de ham nay an toan du goi tu dau (khong phu thuoc hoan toan vao UI).
    if (minDate && dateStr < minDate) return;
    setInputError(false);
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleManualInput = (val: string) => {
    setTextInput(val);
    const trimmed = val.trim();

    if (!trimmed) {
      setInputError(false);
      onChange('');
      return;
    }

    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (ddmmyyyy) {
      const d = parseInt(ddmmyyyy[1], 10);
      const m = parseInt(ddmmyyyy[2], 10);
      const y = parseInt(ddmmyyyy[3], 10);
      const inRange = m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100;
      // 26/08/2026: Fix 2 - sua loi thuc te - truoc ban sua nay chi kiem tra khoang gia tri
      // (ngay 1-31, thang 1-12) roi truyen thang vao `new Date()`; JS se TU DONG "tran" ngay khong
      // hop le sang thang ke tiep thay vi bao loi (vd 31/02/2026 -> am thanh thanh 03/03/2026), khien
      // form cha nhan mot ngay hoan toan khac voi nhung gi nguoi dung go ma khong co canh bao nao.
      // Sua bang cach doi chieu NGUOC LAI: dung Date(y, m-1, d) roi kiem tra .getFullYear()/
      // .getMonth()/.getDate() co khop CHINH XAC voi (y, m, d) da nhap khong - neu JS da "tran"
      // ngay thi it nhat 1 trong 3 gia tri se lech, luc do coi la khong hop le.
      const check = new Date(y, m - 1, d);
      const roundTrips = check.getFullYear() === y && check.getMonth() === m - 1 && check.getDate() === d;

      // 15/09/2026: ap dung minDate cho ca nhap tay - truoc ban sua nay chi luoi ngay bi chan, go
      // thang 1 ngay qua khu hop le dinh dang van lot qua duoc.
      if (inRange && roundTrips) {
        const formatted = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (minDate && formatted < minDate) {
          setInputError(true);
          return;
        }
        setInputError(false);
        onChange(formatted);
        return;
      }

      // Du dinh dang dd/mm/yyyy nhung gia tri khong hop le (vd 31/02/2026, 32/01/2026) hoac truoc
      // minDate - bao loi inline, KHONG goi onChange de tranh luu nham mot ngay sai lech/khong hop
      // le ma nguoi dung khong co y dinh.
      setInputError(true);
      return;
    }

    // Nguoi dung con dang go do (chua du dinh dang dd/mm/yyyy) - khong bao loi, cung khong goi
    // onChange, giu nguyen hanh vi cu.
    setInputError(false);
  };

  const handleClear = () => {
    setInputError(false);
    onChange('');
    setTextInput('');
    setIsOpen(false);
  };

  const handleToday = () => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setInputError(false);
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };

  // Generate Year options
  const YEARS = Array.from({ length: 16 }, (_, i) => today.getFullYear() - 5 + i);

  const [resolvedPosition, setResolvedPosition] = useState<'top' | 'bottom'>(position);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const modalParent = containerRef.current.closest('[role="dialog"]');
    const modalTop = modalParent ? modalParent.getBoundingClientRect().top : 0;
    
    // Nếu khoảng trống bên trên < 230px hoặc mở về phía trên sẽ đụng đỉnh modal/viewport -> mở xuống dưới
    const spaceAbove = rect.top - modalTop;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (position === 'top') {
      if (spaceAbove < 230 && spaceBelow >= 200) {
        setResolvedPosition('bottom');
      } else {
        setResolvedPosition('top');
      }
    } else {
      if (spaceBelow < 230 && spaceAbove >= 200) {
        setResolvedPosition('top');
      } else {
        setResolvedPosition('bottom');
      }
    }
  }, [isOpen, position]);

  const popoverPositionClass =
    resolvedPosition === 'top'
      ? 'bottom-full mb-1.5'
      : 'top-full mt-1.5';
  
  const popoverAlignClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Ô Input: Text thuần bên trái + icon lịch bên phải (§2.3) */}
      <div
        className={cn(
          'relative flex h-9 w-full items-center rounded-radius-sm border bg-white transition-all',
          inputError
            ? 'border-error focus-within:border-error focus-within:ring-2 focus-within:ring-error/20'
            : 'border-border-strong focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20',
        )}
      >
        <input
          id={id}
          type="text"
          value={textInput}
          onChange={(e) => handleManualInput(e.target.value)}
          placeholder={effectivePlaceholder}
          aria-invalid={inputError || undefined}
          aria-describedby={inputError ? errorId : undefined}
          className="h-full w-full rounded-l-radius-sm bg-transparent pl-3 pr-2 font-mono text-[13px] leading-[20px] font-medium text-text-primary outline-none placeholder:font-mono placeholder:text-[13px] placeholder:font-normal placeholder:text-text-tertiary"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title={t('common:datePicker.openCalendarAria')}
          aria-expanded={isOpen}
          aria-haspopup="grid"
          className={cn(
            'flex h-full items-center justify-center border-l border-border-subtle px-2.5 text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer rounded-r-radius-sm',
            isOpen ? 'bg-bg-subtle text-text-primary' : ''
          )}
        >
          <CalendarIcon className="h-4 w-4 stroke-[1.5]" />
        </button>
      </div>
      {inputError && (
        <p id={errorId} role="alert" className="mt-1 text-[11px] font-medium text-text-error animate-fade-in">
          {t('common:datePicker.invalidDate')}
        </p>
      )}

      {/* Popover Calendar Card (Thu nhỏ còn 70% kích thước: width 210px, p-2, cell h-6 w-6, font 11px) */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 w-[210px] rounded-radius-md border border-border-subtle bg-white p-2 shadow-md animate-slide-up select-none flex flex-col justify-between',
            popoverAlignClass,
            popoverPositionClass
          )}
        >
          <div>
            {/* Header: Tháng & Năm + Mũi tên Next/Prev */}
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[11px] leading-tight font-semibold text-text-primary">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  title={t('common:datePicker.prevMonthAria')}
                  className="h-5 w-5 flex items-center justify-center rounded-radius-sm text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
                >
                  <ChevronLeftIcon className="h-3 w-3 stroke-[1.5]" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  title={t('common:datePicker.nextMonthAria')}
                  className="h-5 w-5 flex items-center justify-center rounded-radius-sm text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
                >
                  <ChevronRightIcon className="h-3 w-3 stroke-[1.5]" />
                </button>
              </div>
            </div>

            {/* Thứ trong tuần */}
            <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
              {WEEK_DAYS.map((wd, idx) => (
                <span key={idx} className="text-[10px] font-medium text-text-tertiary tracking-[0.02em]">
                  {wd}
                </span>
              ))}
            </div>

            {/* Lưới các ngày (6 hàng x 7 cột, mỗi cell h-6 w-6 font IBM Plex Mono 11/500) */}
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {/* Ngày tháng trước */}
              {Array.from({ length: startingDayIndex }).map((_, i) => {
                const day = daysInPrevMonth - startingDayIndex + i + 1;
                return (
                  <span key={`prev-${i}`} className="flex h-6 w-6 items-center justify-center font-mono text-[11px] font-normal text-text-tertiary select-none">
                    {day}
                  </span>
                );
              })}

              {/* Ngày tháng hiện tại */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const formattedMonth = String(currentMonth + 1).padStart(2, '0');
                const formattedDay = String(day).padStart(2, '0');
                const dateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;
                const isDisabled = Boolean(minDate) && dateStr < minDate!;

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
                    disabled={isDisabled}
                    onClick={() => !isDisabled && handleSelectDay(day)}
                    className={cn(
                      'flex h-6 w-6 items-center justify-center font-mono text-[11px] font-medium transition-colors tabular-nums',
                      isDisabled
                        ? 'text-text-tertiary opacity-50 cursor-not-allowed'
                        : isSelected
                          ? 'bg-[#0E5E5E] text-white font-semibold rounded-radius-sm cursor-pointer'
                          : isToday
                            ? 'text-accent font-semibold hover:bg-bg-subtle rounded-radius-sm cursor-pointer'
                            : 'text-text-primary hover:bg-bg-subtle rounded-radius-sm cursor-pointer',
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
                  <span key={`next-${i}`} className="flex h-6 w-6 items-center justify-center font-mono text-[11px] font-normal text-text-tertiary select-none">
                    {day}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Quick Action Footer: Clear & Today */}
          <div className="flex items-center justify-between border-t border-border-subtle pt-1.5 mt-1.5 px-0.5 shrink-0">
            <button
              type="button"
              onClick={handleClear}
              className="px-1.5 py-0.5 rounded-radius-xs text-[11px] font-medium text-accent hover:bg-accent-soft transition-colors cursor-pointer"
            >
              {t('common:datePicker.clear')}
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-1.5 py-0.5 rounded-radius-xs text-[11px] font-medium text-accent hover:bg-accent-soft transition-colors cursor-pointer"
            >
              {t('common:datePicker.today')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
