import { Checkbox } from '@/components/ui/Input';
import type { Role } from '@/types';

export function RoleCheckboxList({
  roles,
  selectedIds,
  onChange,
}: {
  roles: Role[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((v) => v !== id) : [...selectedIds, id]);
  }

  if (roles.length === 0) {
    return <p className="text-xs text-slate-400">Chưa có vai trò nào trong hệ thống.</p>;
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-slate-200 p-3">
      {roles.map((role) => (
        <label key={role.id} className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox checked={selectedIds.includes(role.id)} onChange={() => toggle(role.id)} />
          {role.name}
        </label>
      ))}
    </div>
  );
}
