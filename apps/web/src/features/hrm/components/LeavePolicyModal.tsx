import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { QueryState } from '@/components/ui/QueryState';
import { formatDate, getTodayGmt7DateString } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useCreateLeaveAdjustment, useLeaveAdjustmentsQuery, useLeavePolicyQuery, useUpdateLeavePolicy } from '../hooks';

interface LeavePolicyModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 22/09/2026: cau hinh chinh sach nghi phep (HRM-lite mo rong, theo de xuat cua Tien: "Tính phép
 * theo Luật LĐ VN - 12 ngày/năm + thâm niên - Admin - Tự tăng 1 ngày/5 năm, có config"). Chi hien
 * thi (nut mo modal nay) cho nguoi co PERMISSIONS.ORG_MANAGE - xem LeaveRequestsPage.tsx.
 */
export function LeavePolicyModal({ open, onClose }: LeavePolicyModalProps) {
  const { t } = useTranslation();
  const policyQuery = useLeavePolicyQuery();
  const updatePolicy = useUpdateLeavePolicy();

  const [baseDaysPerYear, setBaseDaysPerYear] = useState('12');
  const [seniorityYearsPerBonusDay, setSeniorityYearsPerBonusDay] = useState('5');

  // 04/11/2026: dieu chinh so du phep cho tung nhan vien (chi them, khong sua/xoa). Modal nay chi mo duoc voi ORG_MANAGE.
  const { map: userNameMap, users: orgUsers } = useUserNameMap();
  const createAdjustment = useCreateLeaveAdjustment();
  const [adjUserId, setAdjUserId] = useState('');
  const [adjYear, setAdjYear] = useState(() => getTodayGmt7DateString().slice(0, 4));
  const [adjDays, setAdjDays] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [adjError, setAdjError] = useState('');
  const adjustmentsQuery = useLeaveAdjustmentsQuery(adjUserId, Number(adjYear));
  const userOptions = [
    { value: '', label: t('hrm:leaveRequestsPage.balance.adjust.selectEmployee') },
    ...orgUsers.map((u) => ({ value: u.id, label: u.fullName || u.email })),
  ];

  function handleAdjust() {
    const days = Number(adjDays);
    const year = Number(adjYear);
    if (!adjUserId || !Number.isInteger(year) || !Number.isInteger(days) || days === 0 || !adjNote.trim()) {
      setAdjError(t('hrm:leaveRequestsPage.balance.adjust.invalid'));
      return;
    }
    setAdjError('');
    createAdjustment.mutate(
      { userId: adjUserId, year, days, note: adjNote.trim() },
      {
        onSuccess: () => {
          setAdjDays('');
          setAdjNote('');
        },
      },
    );
  }

  useEffect(() => {
    if (policyQuery.data) {
      setBaseDaysPerYear(String(policyQuery.data.baseDaysPerYear));
      setSeniorityYearsPerBonusDay(String(policyQuery.data.seniorityYearsPerBonusDay));
    }
  }, [policyQuery.data]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updatePolicy.mutate(
      {
        baseDaysPerYear: Number(baseDaysPerYear),
        seniorityYearsPerBonusDay: Number(seniorityYearsPerBonusDay),
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={t('hrm:leaveRequestsPage.balance.policyModalTitle')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('hrm:leaveRequestsPage.balance.baseDaysLabel')} htmlFor="leave-policy-base-days" required>
          <Input
            id="leave-policy-base-days"
            type="number"
            min={0}
            max={60}
            value={baseDaysPerYear}
            onChange={(e) => setBaseDaysPerYear(e.target.value)}
            className="text-xs"
            required
          />
        </FormField>

        <FormField label={t('hrm:leaveRequestsPage.balance.seniorityYearsLabel')} htmlFor="leave-policy-seniority-years" required>
          <Input
            id="leave-policy-seniority-years"
            type="number"
            min={1}
            max={20}
            value={seniorityYearsPerBonusDay}
            onChange={(e) => setSeniorityYearsPerBonusDay(e.target.value)}
            className="text-xs"
            required
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('hrm:leaveRequestsPage.balance.cancelButton')}
          </Button>
          <Button type="submit" size="sm" disabled={updatePolicy.isPending}>
            {t('hrm:leaveRequestsPage.balance.saveButton')}
          </Button>
        </div>
      </form>

      {/* 04/11/2026: Điều chỉnh số dư phép của từng nhân viên */}
      <div className="mt-4 space-y-3 border-t border-border-subtle pt-4">
        <h3 className="text-[13px] font-semibold text-text-primary">{t('hrm:leaveRequestsPage.balance.adjust.title')}</h3>
        <p className="text-[12px] text-text-secondary">{t('hrm:leaveRequestsPage.balance.adjust.hint')}</p>
        <CustomFilterSelect
          value={adjUserId}
          options={userOptions}
          onChange={setAdjUserId}
          ariaLabel={t('hrm:leaveRequestsPage.balance.adjust.selectEmployee')}
          position="bottom"
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('hrm:leaveRequestsPage.balance.adjust.yearLabel')} htmlFor="leave-adjust-year">
            <Input id="leave-adjust-year" type="number" min={2000} max={2100} value={adjYear} onChange={(e) => setAdjYear(e.target.value)} className="text-xs" />
          </FormField>
          <FormField label={t('hrm:leaveRequestsPage.balance.adjust.daysLabel')} htmlFor="leave-adjust-days">
            <Input id="leave-adjust-days" type="number" step={1} value={adjDays} onChange={(e) => setAdjDays(e.target.value)} className="text-xs" />
          </FormField>
        </div>
        <FormField label={t('hrm:leaveRequestsPage.balance.adjust.noteLabel')} htmlFor="leave-adjust-note" error={adjError} required>
          <Input id="leave-adjust-note" value={adjNote} onChange={(e) => setAdjNote(e.target.value)} className="text-xs" />
        </FormField>
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={handleAdjust} disabled={createAdjustment.isPending}>
            {t('hrm:leaveRequestsPage.balance.adjust.addButton')}
          </Button>
        </div>

        {adjUserId && (
          <QueryState
            isLoading={adjustmentsQuery.isLoading}
            isError={adjustmentsQuery.isError}
            onRetry={() => adjustmentsQuery.refetch()}
            errorTitle={t('hrm:leaveRequestsPage.balance.adjust.listError')}
          >
            {(adjustmentsQuery.data ?? []).length === 0 ? (
              <p className="py-2 text-center text-[12px] text-text-tertiary">{t('hrm:leaveRequestsPage.balance.adjust.empty')}</p>
            ) : (
              <ul className="max-h-48 divide-y divide-border-subtle overflow-y-auto rounded-radius-sm border border-border-subtle">
                {(adjustmentsQuery.data ?? []).map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 px-3 py-2 text-[12px]">
                    <div className="min-w-0">
                      <p className="break-words text-text-primary">{a.note}</p>
                      <p className="text-[11px] text-text-tertiary">
                        {formatDate(a.createdAt)} · {userNameMap[a.createdByUserId] ?? ''}
                      </p>
                    </div>
                    <span className={`shrink-0 font-mono font-medium tabular-nums ${a.days < 0 ? 'text-[#B3261E]' : 'text-[#2F6F44]'}`}>
                      {a.days > 0 ? `+${a.days}` : a.days}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        )}
      </div>
    </Modal>
  );
}
