import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Select, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Avatar } from '@/components/ui/Avatar';
import { useProjectsQuery } from '../hooks';
import { createTask, addAssignee } from '../api';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';

interface QuickCreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
}

export function QuickCreateTaskModal({ open, onClose, defaultProjectId }: QuickCreateTaskModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const projectsQuery = useProjectsQuery({ limit: 100, status: 'ACTIVE' });
  const { data: users = [] } = useOrgUsersQuery();

  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const projects = projectsQuery.data?.data ?? [];

  useEffect(() => {
    if (defaultProjectId) {
      setProjectId(defaultProjectId);
    } else if (projects.length > 0 && !projectId) {
      setProjectId(projects[0].id);
    }
  }, [defaultProjectId, projects, projectId]);

  function handleClose() {
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setAssigneeId('');
    setDueDate('');
    setError('');
    setIsSubmitting(false);
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('projects:newTaskModal.titleRequired'));
      return;
    }
    const targetProjectId = projectId || defaultProjectId || (projects[0]?.id ?? '');
    if (!targetProjectId) {
      setError(t('common:quickCreate.selectProjectRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createTask({
        projectId: targetProjectId,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
      });

      if (created?.id) {
        try {
          const storedMeta = JSON.parse(localStorage.getItem('ec_tasks_metadata') || '{}');
          storedMeta[created.id] = { ...(storedMeta[created.id] || {}), priority };
          localStorage.setItem('ec_tasks_metadata', JSON.stringify(storedMeta));
        } catch {
          // ignore
        }
      }

      if (assigneeId && created?.id) {
        try {
          await addAssignee(created.id, assigneeId);
        } catch {
          // Bỏ qua nếu gán người dùng gặp lỗi nhỏ
        }
      }

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(t('projects:toast.task.created'));
      handleClose();
    } catch (err) {
      toast.error(t('projects:toast.task.createError'), extractErrorMessage(err));
      setIsSubmitting(false);
    }
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
      preventCloseWhilePending={isSubmitting}
      title={t('common:quickCreate.createTaskTitle')}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Chọn Dự án (nếu đang ở trang dự án thì bị khóa sẵn hoặc chọn dự án khác) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="quick-task-project">
            {t('common:quickCreate.projectLabel')} *
          </label>
          <Select
            id="quick-task-project"
            value={projectId || defaultProjectId || ''}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={Boolean(defaultProjectId) || isSubmitting}
          >
            {projects.length === 0 ? (
              <option value="">{t('common:quickCreate.noProjectsAvailable')}</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))
            )}
          </Select>
        </div>

        {/* Tiêu đề công việc (Có inline validation) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700" htmlFor="quick-task-title">
              {t('projects:newTaskModal.titleLabel')} *
            </label>
            {error && (
              <span className="text-rose-500 text-xs font-medium animate-fade-in">{error}</span>
            )}
          </div>
          <Input
            id="quick-task-title"
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
          <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="quick-task-assignee">
            {t('common:quickCreate.assigneeLabel')}
          </label>
          <div className="relative">
            <Select
              id="quick-task-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={isSubmitting}
              className={selectedUser ? 'pl-8' : ''}
            >
              <option value="">{t('common:quickCreate.unassigned')}</option>
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
            {t('projects:newProjectModal.priorityLabel')}
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
        <FormField label={t('projects:newTaskModal.descriptionLabel')} htmlFor="quick-task-description">
          <Textarea
            id="quick-task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('common:quickCreate.descriptionPlaceholder')}
            rows={2}
          />
        </FormField>

        {/* Hạn chót (Deadline) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="quick-task-due-date">
            {t('projects:newTaskModal.dueDateLabel')}
          </label>
          <DatePicker id="quick-task-due-date" value={dueDate} onChange={setDueDate} />
        </div>

        {/* Nút hành động */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {t('common:actions.confirm')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

