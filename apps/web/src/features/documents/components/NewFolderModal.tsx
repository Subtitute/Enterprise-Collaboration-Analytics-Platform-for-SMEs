import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { useCreateFolder } from '../hooks';

export function NewFolderModal({ parentId, open, onClose }: { parentId: string | null; open: boolean; onClose: () => void }) {
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
      setError('Vui lòng nhập tên thư mục');
      return;
    }
    createFolder.mutate({ name: name.trim(), parentId }, { onSuccess: handleClose });
  }

  return (
    <Modal open={open} onClose={handleClose} title="Tạo thư mục mới" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label="Tên thư mục" htmlFor="folder-name" error={error} required>
          <Input id="folder-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Hợp đồng 2026" />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button type="submit" isLoading={createFolder.isPending}>
            Tạo thư mục
          </Button>
        </div>
      </form>
    </Modal>
  );
}
