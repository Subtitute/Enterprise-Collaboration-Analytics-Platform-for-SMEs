import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import type { TaskStatus } from '@/types';
import { useCreateTask, useUpdateTaskStatus } from '../hooks';

interface NewTaskModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultColumn?: TaskStatus;
}

export function NewTaskModal({ open, onClose, projectId, defaultColumn }: NewTaskModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  const createTask = useCreateTask(projectId);
  const updateStatus = useUpdateTaskStatus(projectId);

  function handleClose() {
    setTitle('');
    setDescription('');
    setDueDate('');
    setError('');
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
      {
        onSuccess: (createdTask) => {
          if (defaultColumn && defaultColumn !== 'TODO' && createdTask?.id) {
            updateStatus.mutate({ taskId: createdTask.id, status: defaultColumn });
          }
          handleClose();
        },
      },
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('projects:newTaskModal.title')}>
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
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="task-due-date">
            {t('projects:newTaskModal.dueDateLabel')}
          </label>
          <DatePicker id="task-due-date" value={dueDate} onChange={setDueDate} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose}>
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
