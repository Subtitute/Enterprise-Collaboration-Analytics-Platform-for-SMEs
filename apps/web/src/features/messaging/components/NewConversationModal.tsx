import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Input, Checkbox, Label } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { SearchIcon, CheckIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import { useAuthStore } from '@/stores/auth.store';
import { useCreateConversation } from '../hooks';
import type { ConversationWithOwner } from '@/types';

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (conversation: ConversationWithOwner) => void;
}

type ConversationTab = 'DIRECT' | 'GROUP';

/** Modal tao cuoc tro chuyen moi - tab "Tin nhan truc tiep" (chon dung 1 nguoi) va "Nhom" (ten nhom
 *  + chon nhieu nguoi). Goi POST /conversations, DIRECT duoc backend tu dedup neu da ton tai. */
export const NewConversationModal = React.memo(function NewConversationModal({ open, onClose, onCreated }: NewConversationModalProps) {
  const { t } = useTranslation();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data: allUsers = [], isLoading: isUsersLoading } = useOrgUsersQuery({ enabled: open });
  const createConversation = useCreateConversation();

  const [tab, setTab] = useState<ConversationTab>('DIRECT');
  const [search, setSearch] = useState('');
  const [selectedDirectUserId, setSelectedDirectUserId] = useState<string | null>(null);
  const [selectedGroupUserIds, setSelectedGroupUserIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Reset toan bo state moi lan modal duoc mo lai (khong giu du lieu lan truoc).
  useEffect(() => {
    if (!open) return;
    setTab('DIRECT');
    setSearch('');
    setSelectedDirectUserId(null);
    setSelectedGroupUserIds([]);
    setGroupName('');
    setFormError(null);
  }, [open]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (u.id === currentUserId) return false; // Khong the tu nhan tin cho chinh minh.
      if (u.isActive === false) return false;
      if (!q) return true;
      return u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [allUsers, currentUserId, search]);

  function toggleGroupUser(userId: string) {
    setSelectedGroupUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  function handleSubmit() {
    setFormError(null);

    if (tab === 'DIRECT') {
      if (!selectedDirectUserId) {
        setFormError(t('messaging:newConversationModal.selectRecipientError'));
        return;
      }
      createConversation.mutate(
        { type: 'DIRECT', participantUserIds: [selectedDirectUserId] },
        {
          onSuccess: (conversation) => {
            onCreated(conversation);
            onClose();
          },
        },
      );
      return;
    }

    if (!groupName.trim()) {
      setFormError(t('messaging:newConversationModal.groupNameRequiredError'));
      return;
    }
    if (selectedGroupUserIds.length === 0) {
      setFormError(t('messaging:newConversationModal.selectMembersError'));
      return;
    }
    createConversation.mutate(
      { type: 'GROUP', name: groupName.trim(), participantUserIds: selectedGroupUserIds },
      {
        onSuccess: (conversation) => {
          onCreated(conversation);
          onClose();
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('messaging:newConversationModal.title')}
      size="md"
      preventCloseWhilePending={createConversation.isPending}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={createConversation.isPending}
            className="h-8 px-3 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[12px] font-medium text-text-primary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50"
          >
            {t('common:actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createConversation.isPending}
            className="inline-flex items-center justify-center h-8 px-3 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[12px] font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50"
          >
            {createConversation.isPending
              ? t('common:loading')
              : tab === 'DIRECT'
              ? t('messaging:newConversationModal.submit')
              : t('messaging:newConversationModal.submitGroup')}
          </button>
        </>
      }
    >
      <div className="space-y-4 max-h-[min(520px,calc(100vh-200px))] flex flex-col">
        {/* Segmented Control 2 tab */}
        <div className="flex shrink-0 p-1 rounded-radius-sm bg-bg-subtle border border-border-subtle">
          <button
            type="button"
            onClick={() => {
              setTab('DIRECT');
              setFormError(null);
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[4px] text-xs transition-colors cursor-pointer',
              tab === 'DIRECT'
                ? 'bg-white text-text-primary font-semibold border border-border-subtle shadow-none'
                : 'text-text-secondary hover:text-text-primary font-normal',
            )}
          >
            {t('messaging:newConversationModal.tabDirect')}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('GROUP');
              setFormError(null);
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[4px] text-xs transition-colors cursor-pointer',
              tab === 'GROUP'
                ? 'bg-white text-text-primary font-semibold border border-border-subtle shadow-none'
                : 'text-text-secondary hover:text-text-primary font-normal',
            )}
          >
            {t('messaging:newConversationModal.tabGroup')}
          </button>
        </div>

        {tab === 'GROUP' && (
          <div className="shrink-0 space-y-1">
            <Label htmlFor="new-group-name" className="text-xs font-medium text-text-primary">
              {t('messaging:newConversationModal.groupNameLabel')}
            </Label>
            <Input
              id="new-group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t('messaging:newConversationModal.groupNamePlaceholder')}
              maxLength={200}
              className="h-9 rounded-radius-sm border-border-strong text-xs"
            />
          </div>
        )}

        <div className="relative shrink-0">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('messaging:newConversationModal.searchPlaceholder')}
            className="h-9 rounded-radius-sm border-border-strong pl-8 text-xs"
          />
        </div>

        {tab === 'GROUP' && selectedGroupUserIds.length > 0 && (
          <p className="shrink-0 font-mono text-[12px] font-normal tabular-nums text-text-tertiary">
            {t('messaging:newConversationModal.selectedCount', { count: selectedGroupUserIds.length })}
          </p>
        )}

        {/* Danh sach nguoi chi cuon tai day (fix double scrollbar) */}
        <div className="min-h-0 flex-1 overflow-y-auto space-y-0.5 rounded-radius-sm border border-border-subtle p-1 popover-scrollbar">
          {isUsersLoading ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : candidates.length === 0 ? (
            <p className="py-6 text-center text-xs italic text-text-tertiary">{t('messaging:newConversationModal.noUsersFound')}</p>
          ) : tab === 'DIRECT' ? (
            candidates.map((u) => {
              const isSelected = u.id === selectedDirectUserId;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedDirectUserId(u.id)}
                  className={cn(
                    'flex h-11 w-full items-center gap-2.5 rounded-[4px] px-2.5 py-1 text-left text-xs transition-colors cursor-pointer',
                    isSelected ? 'bg-accent-soft text-text-primary' : 'text-text-primary hover:bg-bg-subtle',
                  )}
                >
                  <Avatar
                    name={u.fullName}
                    size="sm"
                    className="h-8 w-8 text-[11px] font-semibold bg-accent-soft text-accent shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.fullName}</p>
                    <p className="truncate font-mono text-[11px] text-text-tertiary">{u.email}</p>
                  </div>
                  {isSelected && <CheckIcon className="h-4 w-4 shrink-0 text-accent" />}
                </button>
              );
            })
          ) : (
            candidates.map((u) => {
              const isSelected = selectedGroupUserIds.includes(u.id);
              return (
                <label
                  key={u.id}
                  className={cn(
                    'flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-[4px] px-2.5 py-1 text-left text-xs transition-colors',
                    isSelected ? 'bg-accent-soft text-text-primary' : 'text-text-primary hover:bg-bg-subtle',
                  )}
                >
                  <Checkbox checked={isSelected} onChange={() => toggleGroupUser(u.id)} />
                  <Avatar
                    name={u.fullName}
                    size="sm"
                    className="h-8 w-8 text-[11px] font-semibold bg-accent-soft text-accent shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.fullName}</p>
                    <p className="truncate font-mono text-[11px] text-text-tertiary">{u.email}</p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        {formError && (
          <p role="alert" className="shrink-0 text-xs font-medium text-error">
            {formError}
          </p>
        )}
      </div>
    </Modal>
  );
});
