import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { useCreateTask } from '../hooks';

export function NewTaskModal({ projectId, open, onClose }: { projectId: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const createTask = useCreateTask(projectId);

  function reset() {
    setTitle('');
    setDescription('');
    setDueDate('');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('projects:newTaskModal.titleRequired'));
      return;
    }
    createTask.mutate(
      { title: title.trim(), description: description.trim() || undefined, dueDate: dueDate || undefined },
      { onSuccess: handleClose },
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      // 26/08/2026: modal nay cung o lai trong DOM (component cha bat/tat qua prop `open`, xem
      // ProjectDetailPage.tsx), mutate() ben tren goi onSuccess: handleClose (dong+reset form) -
      // giong dung 3 loi da sua hom qua (DepartmentModal/EditMemberModal/InviteMemberModal): neu
      // dong+mo lai modal trong luc mutation cu con dang bay, onSuccess cu se dong nham phien ban
      // modal moi. Chan bang prop dung chung cua Modal.tsx thay vi tu viet lai guard.
      preventCloseWhilePending={createTask.isPending}
      title={t('projects:newTaskModal.title')}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('projects:newTaskModal.titleLabel')} htmlFor="task-title" error={error} required>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('projects:newTaskModal.titlePlaceholder')}
          />
        </FormField>
        <FormField label={t('projects:newTaskModal.descriptionLabel')} htmlFor="task-description">
          <Textarea id="task-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <FormField label={t('projects:newTaskModal.dueDateLabel')} htmlFor="task-due-date">
          <Input id="task-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          {/* 26/08/2026: them disabled={createTask.isPending} - nut Huy nay truoc do goi thang
              handleClose khong dieu kien, la 1 duong dong khong bi chan boi preventCloseWhilePending
              (prop do chi chan X/Escape/backdrop trong Modal.tsx, khong bao trum nut tu viet trong
              modal con) - mirror dung disabled đã co san o DepartmentModal.tsx/UploadModal.tsx. */}
          <Button type="button" variant="outline" onClick={handleClose} disabled={createTask.isPending}>
            {t('projects:newTaskModal.cancel')}
          </Button>
          <Button type="submit" isLoading={createTask.isPending}>
            {t('projects:newTaskModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
