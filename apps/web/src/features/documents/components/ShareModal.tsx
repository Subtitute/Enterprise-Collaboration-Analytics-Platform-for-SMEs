import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Select } from '@/components/ui/Input';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import { useShareFile } from '../hooks';
import type { FileItem } from '@/types';

const PERMISSIONS = [
  { value: 'VIEW', label: 'Chỉ xem' },
  { value: 'EDIT', label: 'Chỉnh sửa' },
];

export function ShareModal({ file, onClose }: { file: FileItem | null; onClose: () => void }) {
  const { data: users } = useOrgUsersQuery();
  const [userId, setUserId] = useState('');
  const [permission, setPermission] = useState('VIEW');
  const share = useShareFile();

  function handleClose() {
    setUserId('');
    setPermission('VIEW');
    onClose();
  }

  return (
    <Modal open={Boolean(file)} onClose={handleClose} title={`Chia sẻ "${file?.name ?? ''}"`} size="sm">
      <div className="space-y-4">
        <FormField label="Chia sẻ với" required>
          <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Chọn thành viên…</option>
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} ({u.email})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Quyền truy cập">
          <Select value={permission} onChange={(e) => setPermission(e.target.value)}>
            {PERMISSIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button
            type="button"
            disabled={!userId || !file}
            isLoading={share.isPending}
            onClick={() => {
              if (!file || !userId) return;
              share.mutate({ fileId: file.id, sharedWithUserId: userId, permission }, { onSuccess: handleClose });
            }}
          >
            Chia sẻ
          </Button>
        </div>
      </div>
    </Modal>
  );
}
