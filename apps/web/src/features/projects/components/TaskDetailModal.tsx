import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { TrashIcon, XIcon, ChevronDownIcon, CheckIcon } from '@/components/ui/Icons';
import { Dropdown } from '@/components/ui/Dropdown';
import { formatDateTime, formatRelativeTime, cn } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { TASK_STATUSES } from '@/types';
import type { TaskStatus } from '@/types';

const STATUS_CONFIG: Record<TaskStatus, { dotColor: string; activeBg: string; textColor: string }> = {
  TODO: {
    dotColor: 'bg-[#8A8781]',
    activeBg: 'bg-bg-subtle',
    textColor: 'text-text-primary',
  },
  DOING: {
    dotColor: 'bg-[#1E5A8A]',
    activeBg: 'bg-accent-soft/50',
    textColor: 'text-accent',
  },
  DONE: {
    dotColor: 'bg-[#2F6F44]',
    activeBg: 'bg-[#E6F1E9]',
    textColor: 'text-[#2F6F44]',
  },
};
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

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setTitleDraft(task?.title ?? '');
    setIsEditingTitle(false);
    setDescDraft(task?.description ?? '');
    setIsEditingDesc(false);
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaveTitle() {
    if (!titleDraft.trim() || titleDraft.trim() === task?.title) {
      setTitleDraft(task?.title ?? '');
      setIsEditingTitle(false);
      return;
    }
    updateTask.mutate({ title: titleDraft.trim() }, {
      onSuccess: () => setIsEditingTitle(false),
    });
  }

  function displayName(userId: string, fallbackName?: string) {
    return fallbackName ?? userNames[userId] ?? t('projects:taskDetail.unknownMember');
  }

  const renderModalTitle = (
    <div className="flex items-center gap-2 min-w-0 pr-2">
      {isEditingTitle ? (
        <form
          className="flex items-center gap-2 flex-1 min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveTitle();
          }}
        >
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setTitleDraft(task?.title ?? '');
                setIsEditingTitle(false);
              }
            }}
            autoFocus
            className="w-full rounded-radius-sm border border-accent bg-white px-2.5 py-1 text-[16px] leading-[24px] font-semibold text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </form>
      ) : (
        <div
          onClick={() => setIsEditingTitle(true)}
          className="group flex items-center gap-2 cursor-pointer rounded-radius-sm py-0.5 px-1.5 -ml-1.5 hover:bg-bg-subtle transition-colors flex-1 min-w-0"
          title={t('projects:taskDetail.renameHint')}
        >
          <h2 className="text-[16px] leading-[24px] font-semibold text-text-primary truncate">
            {task?.title ?? t('projects:taskDetail.fallbackTitle')}
          </h2>
          {task?.id && (
            <span className="font-mono text-[12px] font-medium text-text-tertiary tabular-nums shrink-0">
              #{task.id.slice(-4).toUpperCase()}
            </span>
          )}
          <span className="text-[11px] font-medium text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            ✎
          </span>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Modal open={Boolean(taskId)} onClose={onClose} title={renderModalTitle} size="xl">
        <QueryState
          isLoading={tasksQuery.isLoading}
          isError={tasksQuery.isError}
          onRetry={() => tasksQuery.refetch()}
          loadingFallback={
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          }
          errorTitle={t('projects:taskDetail.loadErrorTitle')}
          errorDescription={t('projects:taskDetail.loadErrorDescription')}
        >
          {!task ? (
            <EmptyState
              title={t('projects:taskDetail.notFoundTitle')}
              description={t('projects:taskDetail.notFoundDescription')}
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-6 items-start">
              {/* CỘT TRÁI (2/3): Khu vực nội dung chính (Mô tả, Bình luận, Lịch sử) */}
              <div className="space-y-5 lg:col-span-2 min-w-0">
                {/* 1. Mô tả công việc */}
                <div>
                  <label className="block text-[13px] leading-[20px] font-medium text-text-secondary mb-1.5">
                    {t('projects:taskDetail.descriptionLabel')}
                  </label>
                  {isEditingDesc ? (
                    <div className="space-y-2">
                      <textarea
                        value={descDraft}
                        onChange={(e) => setDescDraft(e.target.value)}
                        rows={4}
                        autoFocus
                        className="w-full rounded-radius-sm border border-border-strong bg-white p-2.5 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent min-h-[80px] resize-y"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={updateTask.isPending}
                          onClick={() => updateTask.mutate({ description: descDraft }, { onSuccess: () => setIsEditingDesc(false) })}
                          className="h-8 px-3 rounded-radius-md bg-[#1C1B1A] text-white text-[13px] font-medium hover:bg-[#2E2C29] transition-colors cursor-pointer"
                        >
                          {t('projects:taskDetail.save')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingDesc(false)}
                          className="h-8 px-3 rounded-radius-md border border-border-strong bg-white text-[13px] font-medium text-text-primary hover:bg-bg-subtle transition-colors cursor-pointer"
                        >
                          {t('projects:taskDetail.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingDesc(true)}
                      className="group block w-full rounded-radius-md bg-bg-canvas border border-border-subtle p-3 text-left text-[13px] text-text-primary transition-colors hover:border-border-strong focus:outline-none cursor-pointer"
                    >
                      {task.description ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{task.description}</p>
                      ) : (
                        <span className="text-text-tertiary italic">
                          {t('projects:taskDetail.descriptionEmpty')}
                        </span>
                      )}
                    </button>
                  )}
                </div>

                {/* 2. Bình luận & Trao đổi */}
                <div>
                  <label className="block text-[13px] leading-[20px] font-medium text-text-secondary mb-1.5">
                    {t('projects:taskDetail.commentsLabel')}
                  </label>
                  <div className="max-h-56 space-y-2.5 overflow-y-auto rounded-radius-md border border-border-subtle bg-bg-canvas p-3">
                    {commentsQuery.isLoading ? (
                      <div className="flex justify-center py-3">
                        <Spinner size="sm" />
                      </div>
                    ) : (commentsQuery.data ?? []).length === 0 ? (
                      <p className="text-[12px] text-text-tertiary text-center py-2">{t('projects:taskDetail.noComments')}</p>
                    ) : (
                      (commentsQuery.data ?? []).map((c) => (
                        <div key={c.id} className="flex items-start gap-2.5 rounded-radius-sm bg-white p-2.5 border border-border-subtle">
                          <Avatar name={displayName(c.authorId, c.authorName)} size="sm" className="h-6 w-6 text-[10px] rounded-full bg-accent-soft text-accent" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-medium text-text-primary">
                              {displayName(c.authorId, c.authorName)}{' '}
                              <span className="ml-1 font-normal text-text-tertiary text-[11px] font-mono">{formatRelativeTime(c.createdAt)}</span>
                            </p>
                            <p className="text-[13px] text-text-secondary mt-0.5 leading-relaxed">{c.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <form
                    className="mt-2.5 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!commentDraft.trim()) return;
                      addComment.mutate(commentDraft.trim(), { onSuccess: () => setCommentDraft('') });
                    }}
                  >
                    <input
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder={t('projects:taskDetail.commentPlaceholder')}
                      className="flex-1 h-9 rounded-radius-sm border border-border-strong bg-white px-3 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <button
                      type="submit"
                      disabled={addComment.isPending}
                      className="h-9 px-3.5 rounded-radius-md bg-[#1C1B1A] text-white text-[13px] font-medium hover:bg-[#2E2C29] transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {t('projects:taskDetail.send')}
                    </button>
                  </form>
                </div>

                {/* 3. Lịch sử trạng thái */}
                <div>
                  <label className="block text-[13px] leading-[20px] font-medium text-text-secondary mb-1.5">
                    {t('projects:taskDetail.statusHistoryLabel')}
                  </label>
                  <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-radius-md border border-border-subtle bg-bg-canvas p-3">
                    {statusHistoryQuery.isLoading ? (
                      <div className="flex justify-center py-3">
                        <Spinner size="sm" />
                      </div>
                    ) : statusHistoryQuery.isError ? (
                      <p className="text-[12px] text-text-tertiary">{t('projects:taskDetail.statusHistoryError')}</p>
                    ) : (statusHistoryQuery.data ?? []).length === 0 ? (
                      <p className="text-[12px] text-text-tertiary text-center py-1">{t('projects:taskDetail.noStatusHistory')}</p>
                    ) : (
                      (statusHistoryQuery.data ?? []).map((entry, index) => (
                        <div key={`${entry.changedAt}-${index}`} className="flex items-center gap-2 text-[12px] text-text-secondary py-0.5">
                          <span className="font-medium text-text-primary">
                            {entry.fromStatus ? t(`projects:enums.taskStatus.${entry.fromStatus}`, { defaultValue: entry.fromStatus }) : '—'}
                            {' → '}
                            {t(`projects:enums.taskStatus.${entry.toStatus}`, { defaultValue: entry.toStatus })}
                          </span>
                          <span className="text-text-tertiary text-[11px] font-mono">
                            • {displayName(entry.actorId ?? '')} • {formatDateTime(entry.changedAt)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* CỘT PHẢI (1/3): Sidebar thuộc tính (Trạng thái, Hạn chót, Phụ trách, Xoá) */}
              <div className="rounded-radius-md border border-border-subtle bg-white p-4 space-y-4 lg:col-span-1 shadow-none">
                {/* 1. Trạng thái */}
                <div>
                  <label className="block text-[13px] leading-[20px] font-medium text-text-secondary mb-1.5" id="task-status-label">
                    {t('projects:taskDetail.statusLabel')}
                  </label>
                  <Dropdown
                    align="left"
                    panelClassName="w-44 p-1 rounded-radius-md border border-border-subtle bg-white shadow-md space-y-0.5"
                    trigger={({ open, toggle }) => {
                      const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.TODO;
                      return (
                        <button
                          type="button"
                          onClick={toggle}
                          aria-labelledby="task-status-label"
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-radius-sm border border-border-strong bg-white px-3 py-1.5 text-[13px] font-medium text-text-primary transition-all hover:border-accent focus:outline-none focus:ring-1 focus:ring-accent h-9',
                            open && 'border-accent ring-1 ring-accent',
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.dotColor)} />
                            <span className="truncate">{t(`projects:enums.taskStatus.${task.status}`)}</span>
                          </div>
                          <ChevronDownIcon
                            className={cn('h-4 w-4 text-text-tertiary shrink-0 transition-transform duration-150', open && 'rotate-180 text-text-primary')}
                          />
                        </button>
                      );
                    }}
                  >
                    {({ close }) => (
                      <div className="space-y-0.5">
                        {TASK_STATUSES.map((s) => {
                          const isSelected = task.status === s;
                          const cfg = STATUS_CONFIG[s];
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                if (task.status !== s) {
                                  updateStatus.mutate({ taskId: task.id, status: s });
                                }
                                close();
                              }}
                              className={cn(
                                'flex w-full items-center justify-between gap-2 rounded-radius-xs px-2.5 py-1.5 text-[12px] font-medium transition-colors text-left cursor-pointer',
                                isSelected
                                  ? cn(cfg.activeBg, cfg.textColor)
                                  : 'text-text-primary hover:bg-bg-subtle',
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.dotColor)} />
                                <span className="truncate">{t(`projects:enums.taskStatus.${s}`)}</span>
                              </div>
                              {isSelected && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-accent" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Dropdown>
                </div>

                {/* 2. Hạn hoàn thành */}
                <div>
                  <label className="block text-[13px] leading-[20px] font-medium text-text-secondary mb-1.5" htmlFor="task-due-date">
                    {t('projects:taskDetail.dueDateLabel')}
                  </label>
                  <DatePicker
                    id="task-due-date"
                    value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                    onChange={(val) => updateTask.mutate({ dueDate: val || undefined })}
                    position="bottom"
                    align="right"
                  />
                </div>

                {/* 3. Người phụ trách */}
                <div className="pt-2 border-t border-border-subtle">
                  <label className="block text-[13px] leading-[20px] font-medium text-text-secondary mb-2">
                    {t('projects:taskDetail.assigneesLabel')}
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {(task.assignees ?? []).map((a) => (
                      <div
                        key={a.userId}
                        className="group flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-canvas py-0.5 pl-1 pr-2 text-[12px] font-medium text-text-primary transition-all hover:border-border-strong"
                      >
                        <Avatar name={displayName(a.userId, a.fullName)} size="sm" className="h-5 w-5 text-[9px] rounded-full bg-accent-soft text-accent" />
                        <span className="max-w-[100px] truncate">{displayName(a.userId, a.fullName)}</span>
                        <button
                          type="button"
                          onClick={() => removeAssignee.mutate(a.userId)}
                          className="text-text-tertiary hover:text-text-error transition-colors p-0.5 cursor-pointer"
                          aria-label={t('projects:taskDetail.removeAssigneeAriaLabel')}
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <AssigneePicker
                      currentAssignees={task.assignees ?? []}
                      onAdd={(userId) => addAssignee.mutate(userId)}
                      isLoading={addAssignee.isPending}
                    />
                  </div>
                  {(task.assignees ?? []).length === 0 && (
                    <p className="mt-1 text-[11px] text-text-tertiary italic">{t('projects:taskDetail.noAssignees')}</p>
                  )}
                </div>

                {/* 4. Thao tác Xoá công việc */}
                <div className="pt-2 border-t border-border-subtle flex justify-center">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 py-1.5 px-2 text-[12px] font-medium text-text-error hover:underline transition-colors cursor-pointer"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    <span>{t('projects:taskDetail.deleteTask')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </QueryState>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (task) deleteTask.mutate(task.id);
          setConfirmDelete(false);
          onClose();
        }}
        title={t('projects:taskDetail.confirmDeleteTitle')}
        description={t('projects:taskDetail.confirmDeleteDescription')}
        confirmLabel={t('projects:taskDetail.deleteTask')}
        danger
      />
    </>
  );
}
