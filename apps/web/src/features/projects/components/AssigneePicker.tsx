import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PlusIcon } from '@/components/ui/Icons';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import type { TaskAssignee } from '@/types';

export function AssigneePicker({
  currentAssignees,
  onAdd,
  isLoading,
}: {
  currentAssignees: TaskAssignee[];
  onAdd: (userId: string) => void;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const { data: users } = useOrgUsersQuery();
  const assignedIds = new Set(currentAssignees.map((a) => a.userId));
  const candidates = (users ?? []).filter((u) => !assignedIds.has(u.id));
  const [selected, setSelected] = useState('');

  if (candidates.length === 0) {
    return <p className="text-xs text-slate-400">{t('projects:assigneePicker.allAssigned')}</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="flex-1"
        // 28/07/2026: them aria-label (phat hien qua ra soat kha nang tiep can) - Select nay khong
        // co Label/FormField nao gan voi no (Label "Người phụ trách" o component cha chi mo ta danh
        // sach chip da phan cong ben tren, khong co htmlFor tro toi Select nay), truoc do trinh doc
        // man hinh khong co ten truy cap nao cho no.
        aria-label={t('projects:assigneePicker.selectAriaLabel')}
      >
        <option value="">{t('projects:assigneePicker.selectPlaceholderOption')}</option>
        {candidates.map((u) => (
          <option key={u.id} value={u.id}>
            {u.fullName} ({u.email})
          </option>
        ))}
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!selected || isLoading}
        onClick={() => {
          if (selected) {
            onAdd(selected);
            setSelected('');
          }
        }}
      >
        <PlusIcon className="h-4 w-4" /> {t('projects:assigneePicker.add')}
      </Button>
    </div>
  );
}
