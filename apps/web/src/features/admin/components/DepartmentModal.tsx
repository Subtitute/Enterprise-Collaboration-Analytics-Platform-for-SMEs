import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      setError(t('admin:departmentModal.nameRequiredError'));
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
    <Modal
      open={open}
      onClose={onClose}
      // 26/08/2026: chuyen guard "khong cho dong modal khi dang co mutation pending" (viet tay hom
      // qua ngay trong handleClose cua file nay) sang prop dung chung preventCloseWhilePending cua
      // Modal.tsx - ly do goc van vay (mutation cu van chay ngam sau khi dong+mo lai modal, xem
      // Modal.tsx de biet chi tiet), chi khac la gio Modal tu chan ca 3 duong dong thay vi tung
      // modal phai tu viet lai.
      preventCloseWhilePending={isPending}
      title={isEditing ? t('admin:departmentModal.editTitle') : t('admin:departmentModal.createTitle')}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('admin:departmentModal.nameLabel')} htmlFor="department-name" error={error} required>
          <Input
            id="department-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('admin:departmentModal.namePlaceholder')}
          />
        </FormField>
        <FormField label={t('admin:departmentModal.descriptionLabel')} htmlFor="department-description">
          <Textarea id="department-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            {t('admin:departmentModal.cancel')}
          </Button>
          <Button type="submit" isLoading={isPending}>
            {isEditing ? t('admin:departmentModal.saveChanges') : t('admin:departmentModal.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
