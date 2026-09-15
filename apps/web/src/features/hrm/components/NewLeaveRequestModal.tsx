import { useState, useRef, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { ChevronDownIcon, CheckIcon } from '@/components/ui/Icons';
import { calculateWorkingDays, cn } from '@/lib/utils';
import { useCreateLeaveRequest } from '../hooks';

export type LeaveTypeOption = 'ANNUAL' | 'SICK' | 'UNPAID';

const LEAVE_TYPE_OPTIONS: Array<{
  value: LeaveTypeOption;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
}> = [
  {
    value: 'ANNUAL',
    dotColor: 'bg-emerald-500',
    badgeBg: 'bg-emerald-50 text-emerald-700 ring-emerald-700/10',
    badgeText: 'text-emerald-700',
  },
  {
    value: 'SICK',
    dotColor: 'bg-amber-500',
    badgeBg: 'bg-amber-50 text-amber-700 ring-amber-700/10',
    badgeText: 'text-amber-700',
  },
  {
    value: 'UNPAID',
    dotColor: 'bg-slate-400',
    badgeBg: 'bg-slate-50 text-slate-700 ring-slate-700/10',
    badgeText: 'text-slate-700',
  },
];

export function NewLeaveRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [leaveType, setLeaveType] = useState<LeaveTypeOption | ''>('');
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ngày hiện tại GMT+7 định dạng YYYY-MM-DD
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  }, []);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const createLeaveRequest = useCreateLeaveRequest();

  const totalWorkingDays = calculateWorkingDays(startDate, endDate);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
    }
    if (isTypeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTypeDropdownOpen]);

  function reset() {
    setLeaveType('');
    setIsTypeDropdownOpen(false);
    setStartDate('');
    setEndDate('');
    setReason('');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError(t('hrm:newLeaveRequestModal.errors.missingDates'));
      return;
    }
    if (startDate < todayStr) {
      setError(t('hrm:newLeaveRequestModal.errors.pastStartDate'));
      return;
    }
    if (endDate < startDate) {
      setError(t('hrm:newLeaveRequestModal.errors.invalidDateRange'));
      return;
    }
    if (!leaveType) {
      setError(t('hrm:newLeaveRequestModal.errors.missingType'));
      return;
    }
    if (!reason.trim()) {
      setError(t('hrm:newLeaveRequestModal.errors.missingReason'));
      return;
    }

    const typePrefix = `[${leaveType}]`;
    const fullReason = `${typePrefix} ${reason.trim()}`;

    createLeaveRequest.mutate(
      { startDate, endDate, reason: fullReason },
      { onSuccess: handleClose },
    );
  }

  const selectedOption = LEAVE_TYPE_OPTIONS.find((opt) => opt.value === leaveType);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      // 26/08/2026: modal nay cung o lai trong DOM (cha bat/tat qua prop `open`), mutate() ben tren
      // goi onSuccess: handleClose (dong+reset form) - giong dung loi da sua hom qua o 4 modal khac
      // (vd DepartmentModal.tsx): neu dong+mo lai modal trong luc mutation cu con dang bay,
      // onSuccess cu se dong nham phien ban modal moi. Chan bang prop dung chung cua Modal.tsx.
      preventCloseWhilePending={createLeaveRequest.isPending}
      title={t('hrm:newLeaveRequestModal.title')}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Bộ chọn thời gian - lịch đồng bộ với DatePicker của hệ thống */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="leave-start-date">
              {t('hrm:newLeaveRequestModal.startDateLabel')} <span className="text-rose-500">*</span>
            </label>
            <DatePicker
              id="leave-start-date"
              value={startDate}
              minDate={todayStr}
              onChange={(val) => {
                setStartDate(val);
                if (error) setError('');
              }}
              position="bottom"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="leave-end-date">
              {t('hrm:newLeaveRequestModal.endDateLabel')} <span className="text-rose-500">*</span>
            </label>
            <DatePicker
              id="leave-end-date"
              value={endDate}
              minDate={startDate || todayStr}
              onChange={(val) => {
                setEndDate(val);
                if (error) setError('');
              }}
              position="bottom"
              align="right"
            />
          </div>
        </div>

        {totalWorkingDays > 0 && (
          <div className="flex items-center gap-1.5 -mt-2 text-xs font-medium text-slate-500">
            <span>• {t('hrm:newLeaveRequestModal.totalWorkingDays', { count: totalWorkingDays })}</span>
          </div>
        )}

        {/* Custom Dropdown chọn Loại nghỉ phép theo phong cách website */}
        <div className="space-y-1.5" ref={dropdownRef}>
          <label className="block text-xs font-semibold text-slate-700">
            {t('hrm:newLeaveRequestModal.typeLabel')} <span className="text-rose-500">*</span>
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
              className={cn(
                'flex h-10 w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm shadow-2xs transition-all cursor-pointer text-left',
                isTypeDropdownOpen
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                  : 'border-slate-300 hover:border-slate-400',
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {selectedOption ? (
                  <span className="font-medium text-slate-900 truncate">
                    {t(`hrm:newLeaveRequestModal.types.${selectedOption.value}`)}
                  </span>
                ) : (
                  <span className="text-slate-400 truncate">
                    {t('hrm:newLeaveRequestModal.typePlaceholder')}
                  </span>
                )}
              </div>
              <ChevronDownIcon
                className={cn(
                  'h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200',
                  isTypeDropdownOpen && 'rotate-180 text-indigo-600',
                )}
              />
            </button>

            {/* Menu options xuất hiện ở dưới khi bấm */}
            {isTypeDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-400/20 animate-slide-up space-y-1">
                {LEAVE_TYPE_OPTIONS.map((opt) => {
                  const isSelected = leaveType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setLeaveType(opt.value);
                        setIsTypeDropdownOpen(false);
                        if (error) setError('');
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer text-left',
                        isSelected
                          ? 'bg-indigo-50/80 text-indigo-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                      )}
                    >
                      <span className="truncate">{t(`hrm:newLeaveRequestModal.types.${opt.value}`)}</span>
                      {isSelected && <CheckIcon className="h-4 w-4 text-indigo-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <FormField label={t('hrm:newLeaveRequestModal.reasonLabel')} htmlFor="leave-reason" error={error} required>
          <Textarea
            id="leave-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('hrm:newLeaveRequestModal.reasonPlaceholder')}
          />
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          {/* 26/08/2026: them disabled={createLeaveRequest.isPending} - nut Huy nay truoc do goi
              thang handleClose khong dieu kien, la 1 duong dong khong bi chan boi
              preventCloseWhilePending (prop do chi chan X/Escape/backdrop trong Modal.tsx, khong
              bao trum nut tu viet trong modal con) - mirror dung disabled da co san o
              DepartmentModal.tsx/UploadModal.tsx. */}
          <button
            type="button"
            onClick={handleClose}
            disabled={createLeaveRequest.isPending}
            className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-2xs disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          >
            {t('hrm:newLeaveRequestModal.cancelButton')}
          </button>
          <Button type="submit" isLoading={createLeaveRequest.isPending}>
            {t('hrm:newLeaveRequestModal.submitButton')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
