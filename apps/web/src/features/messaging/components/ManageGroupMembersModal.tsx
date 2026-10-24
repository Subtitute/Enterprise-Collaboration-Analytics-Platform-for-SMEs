import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { TrashIcon, UsersIcon, PlusIcon, SearchIcon } from '@/components/ui/Icons';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import { useUpdateParticipants } from '../hooks';
import type { Conversation } from '@/types';

interface ManageGroupMembersModalProps {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
}

/** Them/bot thanh vien nhom (PATCH /conversations/:id/participants) - GROUP-only, hien thi bang
 *  ManageGroupMembersButton (da tu gate quyen truoc do). Mirror layout cua
 *  features/projects/components/ProjectMembersModal.tsx (bo phan department/task count, khong ap
 *  dung cho hoi thoai nhom). */
export const ManageGroupMembersModal = React.memo(function ManageGroupMembersModal({ open, onClose, conversation }: ManageGroupMembersModalProps) {
  const { t } = useTranslation();
  const { data: allUsers = [], isLoading: isUsersLoading } = useOrgUsersQuery({ enabled: open });
  const updateParticipants = useUpdateParticipants(conversation.id);

  const [search, setSearch] = useState('');
  const [userToRemove, setUserToRemove] = useState<{ id: string; name: string } | null>(null);

  const memberIdSet = useMemo(() => new Set(conversation.participantUserIds), [conversation.participantUserIds]);
  const members = useMemo(
    () => allUsers.filter((u) => memberIdSet.has(u.id)),
    [allUsers, memberIdSet],
  );
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (memberIdSet.has(u.id)) return false;
      if (u.isActive === false) return false;
      if (!q) return true;
      return u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [allUsers, memberIdSet, search]);

  function handleAdd(userId: string) {
    updateParticipants.mutate({ addUserIds: [userId] });
  }

  function handleConfirmRemove() {
    if (!userToRemove) return;
    updateParticipants.mutate({ removeUserIds: [userToRemove.id] });
    setUserToRemove(null);
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-radius-sm bg-accent-soft text-accent">
              <UsersIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] leading-[24px] font-semibold text-text-primary truncate">
                {t('messaging:manageMembersModal.title')}
              </h2>
              <p className="mt-0.5 max-w-sm truncate text-[13px] font-normal text-text-secondary">{conversation.name}</p>
            </div>
          </div>
        }
        footer={
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3.5 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[12px] font-medium text-text-primary transition-colors cursor-pointer"
          >
            {t('common:actions.close')}
          </button>
        }
      >
        <div className="space-y-4 max-h-[min(520px,calc(100vh-200px))] flex flex-col">
          {/* Khối 1: THÊM THÀNH VIÊN */}
          <div className="shrink-0 space-y-2.5 rounded-radius-sm border border-border-subtle bg-bg-subtle p-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {t('messaging:manageMembersModal.addMemberTitle')}
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('messaging:newConversationModal.searchPlaceholder')}
                className="h-9 w-full rounded-radius-sm border border-border-strong bg-white py-1.5 pl-8 pr-3 text-xs text-text-primary focus:border-accent focus:outline-none"
              />
            </div>
            <div className="max-h-36 space-y-0.5 overflow-y-auto popover-scrollbar">
              {isUsersLoading ? (
                <div className="flex justify-center py-3">
                  <Spinner size="sm" />
                </div>
              ) : candidates.length === 0 ? (
                <p className="py-3 text-center text-xs italic text-text-tertiary">
                  {t('messaging:manageMembersModal.noAvailableCandidates')}
                </p>
              ) : (
                candidates.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={updateParticipants.isPending}
                    onClick={() => handleAdd(u.id)}
                    className="flex h-11 w-full items-center justify-between gap-2 rounded-[4px] px-2.5 py-1 text-left text-xs text-text-primary transition-colors hover:bg-white disabled:opacity-50 cursor-pointer"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar
                        name={u.fullName}
                        size="sm"
                        className="h-7 w-7 text-[10px] font-semibold bg-accent-soft text-accent shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{u.fullName}</p>
                        <p className="truncate font-mono text-[10px] text-text-tertiary">{u.email}</p>
                      </div>
                    </div>
                    <span className="flex h-7 w-7 items-center justify-center rounded-[4px] text-accent hover:bg-accent-soft transition-colors shrink-0">
                      <PlusIcon className="h-4 w-4" />
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Khối 2: THÀNH VIÊN HIỆN TẠI */}
          <div className="min-h-0 flex-1 flex flex-col space-y-2">
            <div className="flex items-center justify-between px-1 shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {t('messaging:manageMembersModal.currentMembersTitle')}
              </span>
              <span className="font-mono text-[12px] font-medium tabular-nums text-text-tertiary">{members.length}</span>
            </div>

            {isUsersLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="sm" />
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 popover-scrollbar">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex h-14 items-center justify-between gap-3 rounded-radius-sm border border-border-subtle bg-white px-3 py-2 shadow-none transition-colors hover:border-border-strong"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        name={m.fullName}
                        size="md"
                        className="h-8 w-8 shrink-0 text-xs font-semibold bg-accent-soft text-accent"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-text-primary" title={m.fullName}>
                          {m.fullName}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-text-tertiary">{m.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUserToRemove({ id: m.id, name: m.fullName })}
                      disabled={updateParticipants.isPending}
                      title={t('messaging:manageMembersModal.removeTooltip')}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-error hover:bg-error-soft transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(userToRemove)}
        onClose={() => setUserToRemove(null)}
        onConfirm={handleConfirmRemove}
        title={t('messaging:manageMembersModal.confirmRemoveTitle')}
        description={t('messaging:manageMembersModal.confirmRemoveDescription', { name: userToRemove?.name ?? '' })}
        danger
        isLoading={updateParticipants.isPending}
      />
    </>
  );
});
