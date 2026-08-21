import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { useCreateFolder } from '../hooks';

export function NewFolderModal({ parentId, open, onClose }: { parentId: string | null; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const createFolder = useCreateFolder();

  function handleClose() {
    setName('');
    setError('');
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('documents:newFolderModal.nameRequiredError'));
      return;
    }
    createFolder.mutate({ name: name.trim(), parentId }, { onSuccess: handleClose });
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('documents:newFolderModal.title')} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('documents:newFolderModal.nameLabel')} htmlFor="folder-name" error={error} required>
          <Input
            id="folder-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('documents:newFolderModal.namePlaceholder')}
          />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            {t('documents:newFolderModal.cancel')}
          </Button>
          <Button type="submit" isLoading={createFolder.isPending}>
            {t('documents:newFolderModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
