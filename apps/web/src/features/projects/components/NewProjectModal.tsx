import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { useCreateProject } from '../hooks';

export function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const createProject = useCreateProject();

  function reset() {
    setName('');
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
    if (!name.trim()) {
      setError(t('projects:newProjectModal.nameRequired'));
      return;
    }
    createProject.mutate(
      { name: name.trim(), description: description.trim() || undefined, dueDate: dueDate || undefined },
      { onSuccess: handleClose },
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('projects:newProjectModal.title')}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('projects:newProjectModal.nameLabel')} htmlFor="project-name" error={error} required>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('projects:newProjectModal.namePlaceholder')}
          />
        </FormField>
        <FormField label={t('projects:newProjectModal.descriptionLabel')} htmlFor="project-description">
          <Textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('projects:newProjectModal.descriptionPlaceholder')}
          />
        </FormField>
        <FormField label={t('projects:newProjectModal.dueDateLabel')} htmlFor="project-due-date">
          <Input id="project-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose}>
            {t('projects:newProjectModal.cancel')}
          </Button>
          <Button type="submit" isLoading={createProject.isPending}>
            {t('projects:newProjectModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
