import { useState } from 'react';
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
  const { data: users } = useOrgUsersQuery();
  const assignedIds = new Set(currentAssignees.map((a) => a.userId));
  const candidates = (users ?? []).filter((u) => !assignedIds.has(u.id));
  const [selected, setSelected] = useState('');

  if (candidates.length === 0) {
    return <p className="text-xs text-slate-400">Tất cả thành viên đã được phân công.</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selected} onChange={(e) => setSelected(e.target.value)} className="flex-1">
        <option value="">Chọn thành viên để thêm…</option>
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
        <PlusIcon className="h-4 w-4" /> Thêm
      </Button>
    </div>
  );
}
