import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { FormField, Input, Select, Textarea, Label } from '@/components/ui/Input';
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
    dotColor: 'bg-slate-400',
    activeBg: 'bg-slate-50',
    textColor: 'text-slate-700',
  },
  DOING: {
    dotColor: 'bg-primary-500',
    activeBg: 'bg-primary-50/70',
    textColor: 'text-primary-700',
  },
  DONE: {
    dotColor: 'bg-emerald-500',
    activeBg: 'bg-emerald-50/70',
    textColor: 'text-emerald-700',
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
            className="w-full rounded-lg border border-primary-500 bg-white px-2.5 py-1 text-base font-bold text-slate-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </form>
      ) : (
        <div
          onClick={() => setIsEditingTitle(true)}
          className="group flex items-center gap-2 cursor-pointer rounded-lg py-0.5 px-1.5 -ml-1.5 hover:bg-slate-100/80 transition-colors flex-1 min-w-0"
          title={t('projects:taskDetail.renameHint')}
        >
          <h2 className="font-display text-base font-bold text-slate-900 truncate">
            {task?.title ?? t('projects:taskDetail.fallbackTitle')}
          </h2>
          <span className="text-[11px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            ✎
          </span>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Modal open={Boolean(taskId)} onClose={onClose} title={renderModalTitle} size="xl">
        {/* 22/08/2026: tach 3 trang thai dang gop lam mot ("dang tai", "loi tai", "khong con ton
            tai") - truoc day chi check "!task" nen ca 3 truong hop deu hien spinner vo han, kha
            nang cao la mot nguoi dung khac da xoa cong viec trong luc modal dang mo. */}
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
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-7 items-start">
              {/* CỘT TRÁI (2/3): Khu vực nội dung chính (Mô tả, Bình luận, Lịch sử) */}
              <div className="space-y-6 lg:col-span-2 min-w-0">
                {/* 1. Mô tả công việc */}
                <div>
                  <Label className="text-sm font-semibold text-slate-800 mb-2">
                    {t('projects:taskDetail.descriptionLabel')}
                  </Label>
                  {isEditingDesc ? (
                    <div className="space-y-2">
                      <Textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={4} autoFocus />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          isLoading={updateTask.isPending}
                          onClick={() => updateTask.mutate({ description: descDraft }, { onSuccess: () => setIsEditingDesc(false) })}
                        >
                          {t('projects:taskDetail.save')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsEditingDesc(false)}>
                          {t('projects:taskDetail.cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingDesc(true)}
                      className="group block w-full rounded-xl bg-slate-50/70 p-3.5 text-left text-sm text-slate-700 transition-all duration-150 hover:bg-slate-100/80 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:bg-white focus:border focus:border-slate-200"
                    >
                      {task.description ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{task.description}</p>
                      ) : (
                        <span className="text-slate-400 italic group-hover:text-slate-500 transition-colors">
                          {t('projects:taskDetail.descriptionEmpty')}
                        </span>
                      )}
                    </button>
                  )}
                </div>

                {/* 2. Bình luận & Trao đổi */}
                <div>
                  <Label className="text-sm font-semibold text-slate-800 mb-2">
                    {t('projects:taskDetail.commentsLabel')}
                  </Label>
                  <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-slate-200/70 bg-slate-50/40 p-3.5">
                    {commentsQuery.isLoading ? (
                      <div className="flex justify-center py-3">
                        <Spinner size="sm" />
                      </div>
                    ) : (commentsQuery.data ?? []).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">{t('projects:taskDetail.noComments')}</p>
                    ) : (
                      (commentsQuery.data ?? []).map((c) => (
                        <div key={c.id} className="flex items-start gap-2.5 rounded-lg bg-white p-2.5 shadow-2xs border border-slate-100">
                          <Avatar name={displayName(c.authorId, c.authorName)} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800">
                              {displayName(c.authorId, c.authorName)}{' '}
                              <span className="ml-1 font-normal text-slate-400 text-[11px]">{formatRelativeTime(c.createdAt)}</span>
                            </p>
                            <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{c.content}</p>
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
                    <Input
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder={t('projects:taskDetail.commentPlaceholder')}
                      className="flex-1 rounded-xl text-sm"
                    />
                    <Button type="submit" size="sm" isLoading={addComment.isPending} className="rounded-xl shrink-0">
                      {t('projects:taskDetail.send')}
                    </Button>
                  </form>
                </div>

                {/* 3. Lịch sử trạng thái */}
                <div>
                  <Label className="text-sm font-semibold text-slate-800 mb-2">
                    {t('projects:taskDetail.statusHistoryLabel')}
                  </Label>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-slate-200/70 bg-slate-50/40 p-3">
                    {statusHistoryQuery.isLoading ? (
                      <div className="flex justify-center py-3">
                        <Spinner size="sm" />
                      </div>
                    ) : statusHistoryQuery.isError ? (
                      <p className="text-xs text-slate-400">{t('projects:taskDetail.statusHistoryError')}</p>
                    ) : (statusHistoryQuery.data ?? []).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-1">{t('projects:taskDetail.noStatusHistory')}</p>
                    ) : (
                      (statusHistoryQuery.data ?? []).map((entry, index) => (
                        <div key={`${entry.changedAt}-${index}`} className="flex items-center gap-2 text-xs text-slate-600 py-0.5">
                          <span className="font-medium text-slate-700">
                            {entry.fromStatus ? t(`projects:enums.taskStatus.${entry.fromStatus}`, { defaultValue: entry.fromStatus }) : '—'}
                            {' → '}
                            {t(`projects:enums.taskStatus.${entry.toStatus}`, { defaultValue: entry.toStatus })}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            • {displayName(entry.actorId ?? '')} • {formatDateTime(entry.changedAt)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* CỘT PHẢI (1/3): Sidebar thuộc tính (Trạng thái, Hạn chót, Phụ trách, Xoá) */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-4 lg:col-span-1 shadow-2xs">
                {/* 1. Trạng thái */}
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5" id="task-status-label">
                    {t('projects:taskDetail.statusLabel')}
                  </label>
                  <Dropdown
                    align="left"
                    panelClassName="w-48 p-1.5 rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/10 space-y-1"
                    trigger={({ open, toggle }) => {
                      const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.TODO;
                      return (
                        <button
                          type="button"
                          onClick={toggle}
                          aria-labelledby="task-status-label"
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs transition-all duration-150 hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                            open && 'border-primary-500 ring-2 ring-primary-500/20 bg-slate-50/80',
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn('h-2 w-2 rounded-full ring-2 ring-white shrink-0', cfg.dotColor)} />
                            <span className="truncate">{t(`projects:enums.taskStatus.${task.status}`)}</span>
                          </div>
                          <ChevronDownIcon
                            className={cn('h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200', open && 'rotate-180 text-slate-600')}
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
                                'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-150 text-left',
                                isSelected
                                  ? cn('font-bold', cfg.activeBg, cfg.textColor)
                                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={cn('h-2 w-2 rounded-full ring-2 ring-white shrink-0', cfg.dotColor)} />
                                <span className="truncate">{t(`projects:enums.taskStatus.${s}`)}</span>
                              </div>
                              {isSelected && <CheckIcon className="h-4 w-4 shrink-0 text-primary-600" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Dropdown>
                </div>

                {/* 2. Hạn hoàn thành */}
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5" htmlFor="task-due-date">
                    {t('projects:taskDetail.dueDateLabel')}
                  </label>
                  <DatePicker
                    id="task-due-date"
                    value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                    onChange={(val) => updateTask.mutate({ dueDate: val || undefined })}
                  />
                </div>

                {/* 3. Người phụ trách */}
                <div className="pt-1 border-t border-slate-200/60">
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    {t('projects:taskDetail.assigneesLabel')}
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {(task.assignees ?? []).map((a) => (
                      <div
                        key={a.userId}
                        className="group flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white py-1 pl-1 pr-2 text-xs font-medium text-slate-700 shadow-2xs transition-all hover:border-slate-300"
                      >
                        <Avatar name={displayName(a.userId, a.fullName)} size="sm" />
                        <span className="max-w-[100px] truncate">{displayName(a.userId, a.fullName)}</span>
                        <button
                          type="button"
                          onClick={() => removeAssignee.mutate(a.userId)}
                          className="text-slate-300 hover:text-rose-600 transition-colors p-0.5"
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
                    <p className="mt-1.5 text-xs text-slate-400 italic">{t('projects:taskDetail.noAssignees')}</p>
                  )}
                </div>

                {/* 4. Thao tác Xoá công việc (Hạ cấp thành Text Link tinh gọn) */}
                <div className="pt-2 border-t border-slate-200/60 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="group inline-flex items-center gap-1.5 py-1.5 px-2 text-xs font-semibold text-rose-500 transition-colors duration-150 hover:text-rose-700 focus:outline-none focus-visible:underline"
                  >
                    <TrashIcon className="h-3.5 w-3.5 text-rose-400 group-hover:text-rose-600 transition-colors" />
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
