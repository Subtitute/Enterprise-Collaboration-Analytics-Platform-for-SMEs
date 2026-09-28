import { useMemo, useState } from 'react';
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
export function ManageGroupMembersModal({ open, onClose, conversation }: ManageGroupMembersModalProps) {
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-200/60 bg-indigo-50 text-indigo-600 shadow-2xs">
              <UsersIcon className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('messaging:manageMembersModal.title')}</h2>
              <p className="mt-0.5 max-w-sm truncate text-xs font-normal text-slate-500">{conversation.name}</p>
            </div>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          <div className="space-y-2.5 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              {t('messaging:manageMembersModal.addMemberTitle')}
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('messaging:newConversationModal.searchPlaceholder')}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {isUsersLoading ? (
                <div className="flex justify-center py-3">
                  <Spinner size="sm" />
                </div>
              ) : candidates.length === 0 ? (
                <p className="py-3 text-center text-xs italic text-slate-400">
                  {t('messaging:manageMembersModal.noAvailableCandidates')}
                </p>
              ) : (
                candidates.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={updateParticipants.isPending}
                    onClick={() => handleAdd(u.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs text-slate-700 transition-colors hover:bg-white disabled:opacity-50"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar name={u.fullName} size="sm" className="h-6 w-6 text-[10px]" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{u.fullName}</p>
                        <p className="truncate text-[10px] text-slate-400">{u.email}</p>
                      </div>
                    </div>
                    <PlusIcon className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {t('messaging:manageMembersModal.currentMembersTitle')}
              </span>
              <span className="text-xs font-medium text-slate-400">{members.length}</span>
            </div>

            {isUsersLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="sm" />
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white p-2.5 shadow-2xs transition-all hover:border-slate-300"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={m.fullName} size="md" className="h-9 w-9 shrink-0 text-xs ring-1 ring-slate-100" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900" title={m.fullName}>
                          {m.fullName}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">{m.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUserToRemove({ id: m.id, name: m.fullName })}
                      disabled={updateParticipants.isPending}
                      title={t('messaging:manageMembersModal.removeTooltip')}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
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
}
