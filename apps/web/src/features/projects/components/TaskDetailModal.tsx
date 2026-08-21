import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { FormField, Input, Select, Textarea, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { TrashIcon, XIcon } from '@/components/ui/Icons';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { TASK_STATUSES } from '@/types';
import type { TaskStatus } from '@/types';
import {
  useAddAssignee,
  useAddComment,
  useCommentsQuery,
  useDeleteTask,
  useRemoveAssignee,
  useTaskStatusHistory,
  useTasksQuery,
  useUpdateTask,
  useUpdateTaskStatus,
} from '../hooks';
import { AssigneePicker } from './AssigneePicker';

interface TaskDetailModalProps {
  projectId: string;
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailModal({ projectId, taskId, onClose }: TaskDetailModalProps) {
  const { t } = useTranslation();
  const tasksQuery = useTasksQuery(projectId);
  const task = tasksQuery.data?.find((t) => t.id === taskId);

  const updateStatus = useUpdateTaskStatus(projectId);
  const updateTask = useUpdateTask(projectId, taskId ?? '');
  const deleteTask = useDeleteTask(projectId);
  const addAssignee = useAddAssignee(projectId, taskId ?? '');
  const removeAssignee = useRemoveAssignee(projectId, taskId ?? '');
  const commentsQuery = useCommentsQuery(taskId ?? undefined);
  const addComment = useAddComment(taskId ?? '');
  const statusHistoryQuery = useTaskStatusHistory(taskId ?? undefined);
  const { map: userNames } = useUserNameMap();

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDescDraft(task?.description ?? '');
    setIsEditingDesc(false);
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function displayName(userId: string, fallbackName?: string) {
    return fallbackName ?? userNames[userId] ?? 'Thành viên';
  }

  return (
    <>
      <Modal open={Boolean(taskId)} onClose={onClose} title={task?.title ?? 'Công việc'} size="lg">
        {!task ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              {/* 25/07/2026: them htmlFor/id (task-status-select, task-due-date) - truoc ban sua
                  nay FormField co san prop htmlFor nhung khong duoc truyen o day nen <Label> khong
                  gan duoc voi control tuong ung (trinh doc man hinh/bam vao label khong focus vao
                  input), khac voi pattern chuan da dung o NewTaskModal.tsx/NewProjectModal.tsx. */}
              <FormField label="Trạng thái" htmlFor="task-status-select" className="w-40">
                <Select
                  id="task-status-select"
                  value={task.status}
                  onChange={(e) => updateStatus.mutate({ taskId: task.id, status: e.target.value as TaskStatus })}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`projects:enums.taskStatus.${s}`)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Hạn hoàn thành" htmlFor="task-due-date" className="w-40">
                <Input
                  id="task-due-date"
                  type="date"
                  defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                  onBlur={(e) => updateTask.mutate({ dueDate: e.target.value || undefined })}
                />
              </FormField>
              <Button
                type="button"
                variant="ghost"
                className="ml-auto text-rose-600 hover:bg-rose-50"
                onClick={() => setConfirmDelete(true)}
              >
                <TrashIcon className="h-4 w-4" /> Xoá công việc
              </Button>
            </div>

            <div>
              <Label>Mô tả</Label>
              {isEditingDesc ? (
                <div className="space-y-2">
                  <Textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={4} autoFocus />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      isLoading={updateTask.isPending}
                      onClick={() => updateTask.mutate({ description: descDraft }, { onSuccess: () => setIsEditingDesc(false) })}
                    >
                      Lưu
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditingDesc(false)}>
                      Hủy
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingDesc(true)}
                  className="block w-full rounded-lg border border-dashed border-slate-200 p-3 text-left text-sm text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                >
                  {task.description || <span className="text-slate-400">Chưa có mô tả. Bấm để thêm…</span>}
                </button>
              )}
            </div>

            <div>
              <Label>Người phụ trách</Label>
              <div className="mb-2 flex flex-wrap gap-2">
                {(task.assignees ?? []).length === 0 && <p className="text-xs text-slate-400">Chưa có ai được phân công.</p>}
                {(task.assignees ?? []).map((a) => (
                  <span key={a.userId} className="flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-2 text-xs text-slate-700">
                    <Avatar name={displayName(a.userId, a.fullName)} size="sm" />
                    {displayName(a.userId, a.fullName)}
                    <button
                      type="button"
                      onClick={() => removeAssignee.mutate(a.userId)}
                      className="text-slate-400 hover:text-rose-600"
                      aria-label="Gỡ khỏi công việc"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <AssigneePicker
                currentAssignees={task.assignees ?? []}
                onAdd={(userId) => addAssignee.mutate(userId)}
                isLoading={addAssignee.isPending}
              />
            </div>

            <div>
              <Label>Bình luận</Label>
              <div className="max-h-52 space-y-3 overflow-y-auto rounded-lg border border-slate-100 p-3">
                {commentsQuery.isLoading ? (
                  <div className="flex justify-center py-3">
                    <Spinner size="sm" />
                  </div>
                ) : (commentsQuery.data ?? []).length === 0 ? (
                  <p className="text-xs text-slate-400">Chưa có bình luận nào.</p>
                ) : (
                  (commentsQuery.data ?? []).map((c) => (
                    <div key={c.id} className="flex items-start gap-2">
                      <Avatar name={displayName(c.authorId, c.authorName)} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700">
                          {displayName(c.authorId, c.authorName)}{' '}
                          <span className="ml-1 font-normal text-slate-400">{formatRelativeTime(c.createdAt)}</span>
                        </p>
                        <p className="text-sm text-slate-600">{c.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!commentDraft.trim()) return;
                  addComment.mutate(commentDraft.trim(), { onSuccess: () => setCommentDraft('') });
                }}
              >
                <Input
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Viết bình luận…"
                  className="flex-1"
                />
                <Button type="submit" size="sm" isLoading={addComment.isPending}>
                  Gửi
                </Button>
              </form>
            </div>

            <div>
              <Label>Lịch sử thay đổi trạng thái</Label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-100 p-3">
                {statusHistoryQuery.isLoading ? (
                  <div className="flex justify-center py-3">
                    <Spinner size="sm" />
                  </div>
                ) : statusHistoryQuery.isError ? (
                  <p className="text-xs text-slate-400">Không thể tải lịch sử thay đổi trạng thái.</p>
                ) : (statusHistoryQuery.data ?? []).length === 0 ? (
                  <p className="text-xs text-slate-400">Chưa có lịch sử thay đổi trạng thái.</p>
                ) : (
                  (statusHistoryQuery.data ?? []).map((entry, index) => (
                    <div key={`${entry.changedAt}-${index}`} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="font-medium text-slate-700">
                        {entry.fromStatus ? t(`projects:enums.taskStatus.${entry.fromStatus}`, { defaultValue: entry.fromStatus }) : '—'}
                        {' → '}
                        {t(`projects:enums.taskStatus.${entry.toStatus}`, { defaultValue: entry.toStatus })}
                      </span>
                      <span className="text-slate-400">
                        • {displayName(entry.actorId ?? '')} • {formatDateTime(entry.changedAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (task) deleteTask.mutate(task.id);
          setConfirmDelete(false);
          onClose();
        }}
        title="Xoá công việc này?"
        description="Hành động này không thể hoàn tác."
        confirmLabel="Xoá công việc"
        danger
      />
    </>
  );
}
