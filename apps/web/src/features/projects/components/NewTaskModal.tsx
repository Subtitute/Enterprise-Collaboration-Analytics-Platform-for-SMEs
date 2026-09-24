import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Select, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Avatar } from '@/components/ui/Avatar';
import type { TaskStatus } from '@/types';
import { useCreateTask, useUpdateTaskStatus } from '../hooks';
import { addAssignee } from '../api';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';

interface NewTaskModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultColumn?: TaskStatus;
}

export function NewTaskModal({ open, onClose, projectId, defaultColumn }: NewTaskModalProps) {
  const { t } = useTranslation();
  const { data: users = [] } = useOrgUsersQuery({ enabled: open });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  const createTask = useCreateTask(projectId);
  const updateStatus = useUpdateTaskStatus(projectId);

  function handleClose() {
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setAssigneeId('');
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
        onSuccess: async (createdTask) => {
          if (createdTask?.id) {
            try {
              const storedMeta = JSON.parse(localStorage.getItem('ec_tasks_metadata') || '{}');
              storedMeta[createdTask.id] = { ...(storedMeta[createdTask.id] || {}), priority };
              localStorage.setItem('ec_tasks_metadata', JSON.stringify(storedMeta));
            } catch {
              // ignore
            }

            if (assigneeId) {
              try {
                await addAssignee(createdTask.id, assigneeId);
              } catch {
                // ignore
              }
            }

            if (defaultColumn && defaultColumn !== 'TODO') {
              updateStatus.mutate({ taskId: createdTask.id, status: defaultColumn });
            }
          }
          handleClose();
        },
      },
    );
  }

  const PRIORITY_OPTIONS = [
    { value: 'LOW', label: t('projects:newProjectModal.priorities.LOW'), color: 'text-slate-600 bg-slate-50 border-slate-200' },
    { value: 'MEDIUM', label: t('projects:newProjectModal.priorities.MEDIUM'), color: 'text-blue-700 bg-blue-50 border-blue-200' },
    { value: 'HIGH', label: t('projects:newProjectModal.priorities.HIGH'), color: 'text-amber-700 bg-amber-50 border-amber-200' },
    { value: 'URGENT', label: t('projects:newProjectModal.priorities.URGENT'), color: 'text-rose-700 bg-rose-50 border-rose-200' },
  ] as const;

  const selectedUser = users.find((u) => u.id === assigneeId);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      preventCloseWhilePending={createTask.isPending}
      title={t('projects:newTaskModal.title')}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Tiêu đề công việc với inline validation viền đỏ */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700" htmlFor="task-title">
              {t('projects:newTaskModal.titleLabel')} *
            </label>
            {error && (
              <span className="text-rose-500 text-xs font-medium animate-fade-in">{error}</span>
            )}
          </div>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError('');
            }}
            placeholder={t('projects:newTaskModal.titlePlaceholder')}
            className={error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-200' : ''}
            autoFocus
          />
        </div>

        {/* Người thực hiện (Assignee) kèm avatar */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="task-assignee">
            {t('projects:newTaskModal.assigneeLabel')}
          </label>
          <div className="relative">
            <Select
              id="task-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={createTask.isPending}
              className={selectedUser ? 'pl-8' : ''}
            >
              <option value="">{t('projects:newTaskModal.unassigned')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({u.email})
                </option>
              ))}
            </Select>
            {selectedUser && (
              <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
                <Avatar name={selectedUser.fullName} size="sm" className="h-4.5 w-4.5 text-[9px]" />
              </div>
            )}
          </div>
        </div>

        {/* Độ ưu tiên (Segmented control) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            {t('projects:newTaskModal.priorityLabel')}
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {PRIORITY_OPTIONS.map((opt) => {
              const isSelected = priority === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`flex h-8 items-center justify-center rounded-lg border text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? `${opt.color} ring-2 ring-primary-500 font-bold shadow-xs`
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mô tả */}
        <FormField label={t('projects:newTaskModal.descriptionLabel')} htmlFor="task-description">
          <Textarea id="task-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </FormField>

        {/* Hạn chót */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="task-due-date">
            {t('projects:newTaskModal.dueDateLabel')}
          </label>
          <DatePicker id="task-due-date" value={dueDate} onChange={setDueDate} />
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
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
