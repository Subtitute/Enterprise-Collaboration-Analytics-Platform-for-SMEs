import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { useLeavePolicyQuery, useUpdateLeavePolicy } from '../hooks';

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
    <Modal open={open} onClose={onClose} title={t('hrm:leaveRequestsPage.balance.policyModalTitle')} size="sm">
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
    </Modal>
  );
}
