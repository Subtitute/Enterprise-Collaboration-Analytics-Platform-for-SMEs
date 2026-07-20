import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { useCreateTask } from '../hooks';

export function NewTaskModal({ projectId, open, onClose }: { projectId: string; open: boolean; onClose: () => void }) {
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
      setError('Vui lòng nhập tiêu đề công việc');
      return;
    }
    createTask.mutate(
      { title: title.trim(), description: description.trim() || undefined, dueDate: dueDate || undefined },
      { onSuccess: handleClose },
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Tạo công việc mới">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label="Tiêu đề" htmlFor="task-title" error={error} required>
          <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Thiết kế giao diện trang chủ" />
        </FormField>
        <FormField label="Mô tả" htmlFor="task-description">
          <Textarea id="task-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <FormField label="Hạn hoàn thành" htmlFor="task-due-date">
          <Input id="task-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button type="submit" isLoading={createTask.isPending}>
            Tạo công việc
          </Button>
        </div>
      </form>
    </Modal>
  );
}
