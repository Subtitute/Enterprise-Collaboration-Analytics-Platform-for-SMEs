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
    <Modal
      open={open}
      onClose={handleClose}
      // 26/08/2026: modal nay cung o lai trong DOM (cha bat/tat qua prop `open`), mutate() ben tren
      // goi onSuccess: handleClose (dong+reset form) - giong dung loi da sua hom qua o 4 modal khac
      // (vd DepartmentModal.tsx): neu dong+mo lai modal trong luc mutation cu con dang bay,
      // onSuccess cu se dong nham phien ban modal moi. Chan bang prop dung chung cua Modal.tsx.
      preventCloseWhilePending={createFolder.isPending}
      title={t('documents:newFolderModal.title')}
      size="sm"
    >
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
          {/* 26/08/2026: them disabled={createFolder.isPending} - nut Huy nay truoc do goi thang
              handleClose khong dieu kien, la 1 duong dong khong bi chan boi preventCloseWhilePending
              (prop do chi chan X/Escape/backdrop trong Modal.tsx, khong bao trum nut tu viet trong
              modal con) - mirror dung disabled đã co san o DepartmentModal.tsx/UploadModal.tsx. */}
          <Button type="button" variant="outline" onClick={handleClose} disabled={createFolder.isPending}>
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
