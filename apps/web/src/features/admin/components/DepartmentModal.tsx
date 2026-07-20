import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { useCreateDepartment, useUpdateDepartment } from '../hooks';
import type { Department } from '@/types';

export function DepartmentModal({
  open,
  onClose,
  department,
}: {
  open: boolean;
  onClose: () => void;
  department?: Department | null;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const isEditing = Boolean(department);

  useEffect(() => {
    if (open) {
      setName(department?.name ?? '');
      setDescription(department?.description ?? '');
      setError('');
    }
  }, [open, department]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên phòng ban');
      return;
    }
    const payload = { name: name.trim(), description: description.trim() || undefined };
    if (isEditing && department) {
      updateDepartment.mutate({ id: department.id, payload }, { onSuccess: onClose });
    } else {
      createDepartment.mutate(payload, { onSuccess: onClose });
    }
  }

  const isPending = createDepartment.isPending || updateDepartment.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Chỉnh sửa phòng ban' : 'Tạo phòng ban mới'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label="Tên phòng ban" htmlFor="department-name" error={error} required>
          <Input id="department-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Phòng Kinh doanh" />
        </FormField>
        <FormField label="Mô tả" htmlFor="department-description">
          <Textarea id="department-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" isLoading={isPending}>
            {isEditing ? 'Lưu thay đổi' : 'Tạo phòng ban'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
