import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FormField, Select, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { CalendarIcon, CheckIcon } from '@/components/ui/Icons';
import { cn, getTodayGmt7DateString } from '@/lib/utils';
import { useCreateLeaveRequest } from '@/features/hrm/hooks';
import type { ChatMessage } from '@/types';

// 03/10/2026: cung 1 quy uoc [LOAI] ngay truoc reason ma NewLeaveRequestModal.tsx dang dung that su
// (CreateLeaveRequestPayload KHONG co field leaveType rieng - server doc loai nghi phep tu chinh
// tien to nay trong `reason`, xem parseLeaveReason() trong LeaveRequestsPage.tsx) - PHAI lap lai
// dung quy uoc nay thi yeu cau tao tu goi y chat moi hien dung "Loai nghi phep" o "Lich su nghi
// phep", khong thi se hien thi nhu 1 yeu cau "khong ro loai".
const LEAVE_TYPE_OPTIONS = ['ANNUAL', 'SICK', 'UNPAID'] as const;
type LeaveTypeOption = (typeof LEAVE_TYPE_OPTIONS)[number];

/** Chip goi y + form tao nhanh yeu cau nghi phep tu 1 tin nhan CUA CHINH NGUOI DANG DANG NHAP co
 *  chua ngay/gio/khoang thoi gian (xem leaveDetection.ts). Component CHA (ConversationThread.tsx)
 *  la noi QUYET DINH co render component nay khong - no tu goi detectLeaveIntent() (ham thuan,
 *  khong phai hook) de loc CA 2 dieu kien (isMine VA co khop pattern) TRUOC khi mount, nen o day
 *  khong con nhan/kiem tra lai `isMine` nua (tranh 1 duong hiem gap de lo set sai) va cung tranh
 *  mount useCreateLeaveRequest() (1 hook mutation that su, co dang ky callback) cho MOI tin nhan cua
 *  minh trong 1 doan chat dai - chi mount khi THAT SU co the hien goi y.
 *  Trang thai "da gui" la state CUC BO cua component nay (khong luu DB/localStorage) - gan voi doi
 *  song cua 1 the <MessageBubble key={message.id}>, nen "theo message id" 1 cach tu nhien va MAT khi
 *  tai lai trang, dung nhu pham vi yeu cau (chi tranh gui trung trong phien lam viec hien tai). */
export function LeaveRequestSuggestion({ message, resolvedDate }: { message: ChatMessage; resolvedDate: string }) {
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [date, setDate] = useState(resolvedDate);
  const [reason, setReason] = useState(message.body);
  const [leaveType, setLeaveType] = useState<LeaveTypeOption>('ANNUAL');
  const [error, setError] = useState('');
  const createLeaveRequest = useCreateLeaveRequest();

  const todayGmt7 = getTodayGmt7DateString();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!date) {
      setError(t('messaging:leaveSuggestion.errors.missingDate'));
      return;
    }
    // 03/10/2026: "thu Hai tuan nay" noi vao thu Nam se tra ve 1 ngay DA QUA trong tuan (xem
    // resolveWeekday() trong leaveDetection.ts) - chan lai o day truoc khi goi mutate(), mirror dung
    // loi "startDateInPast" NewLeaveRequestModal.tsx da tung sua (15/09/2026) sau phan hoi thuc te
    // tu GVHD, tranh lap lai dung loi do o 1 duong tao yeu cau nghi phep MOI nay.
    if (date < todayGmt7) {
      setError(t('messaging:leaveSuggestion.errors.dateInPast'));
      return;
    }
    if (!reason.trim()) {
      setError(t('messaging:leaveSuggestion.errors.missingReason'));
      return;
    }
    const fullReason = `[${leaveType}] ${reason.trim()}`;
    createLeaveRequest.mutate(
      { startDate: date, endDate: date, reason: fullReason },
      {
        onSuccess: () => {
          setIsConfirmed(true);
          setIsOpen(false);
        },
      },
    );
  }

  if (isConfirmed) {
    return (
      <Badge variant="success" className="mt-1 gap-1">
        <CheckIcon className="h-3 w-3" />
        {t('messaging:leaveSuggestion.confirmed')}
      </Badge>
    );
  }

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)} className="mt-1 w-fit cursor-pointer">
        <Badge variant="info" className="gap-1 transition-colors hover:bg-primary-200">
          <CalendarIcon className="h-3 w-3" />
          {t('messaging:leaveSuggestion.chipLabel')}
        </Badge>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-1.5 w-full max-w-xs space-y-2.5 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-md"
    >
      <p className="text-xs font-semibold text-slate-700">{t('messaging:leaveSuggestion.formTitle')}</p>

      <FormField label={t('messaging:leaveSuggestion.dateLabel')} htmlFor={`leave-date-${message.id}`} required>
        <DatePicker
          id={`leave-date-${message.id}`}
          value={date}
          minDate={todayGmt7}
          onChange={(val) => {
            setDate(val);
            if (error) setError('');
          }}
          position="bottom"
        />
      </FormField>

      <FormField label={t('messaging:leaveSuggestion.typeLabel')} htmlFor={`leave-type-${message.id}`}>
        <Select
          id={`leave-type-${message.id}`}
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value as LeaveTypeOption)}
        >
          {LEAVE_TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {t(`hrm:newLeaveRequestModal.types.${opt}`)}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label={t('messaging:leaveSuggestion.reasonLabel')} htmlFor={`leave-reason-${message.id}`} error={error} required>
        <Textarea
          id={`leave-reason-${message.id}`}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (error) setError('');
          }}
          rows={2}
          className="min-h-0 text-xs"
        />
      </FormField>

      <div className="flex justify-end gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          disabled={createLeaveRequest.isPending}
          className={cn(
            'h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700',
            'hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          {t('messaging:leaveSuggestion.cancel')}
        </button>
        <Button type="submit" size="sm" isLoading={createLeaveRequest.isPending}>
          {t('messaging:leaveSuggestion.submit')}
        </Button>
      </div>
    </form>
  );
}
