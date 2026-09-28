import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
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
export function NewConversationModal({ open, onClose, onCreated }: NewConversationModalProps) {
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
          <Button variant="outline" onClick={onClose} disabled={createConversation.isPending}>
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} isLoading={createConversation.isPending}>
            {tab === 'DIRECT' ? t('messaging:newConversationModal.submit') : t('messaging:newConversationModal.submitGroup')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Tabs
          value={tab}
          onChange={(v) => {
            setTab(v as ConversationTab);
            setFormError(null);
          }}
          tabs={[
            { value: 'DIRECT', label: t('messaging:newConversationModal.tabDirect') },
            { value: 'GROUP', label: t('messaging:newConversationModal.tabGroup') },
          ]}
        />

        {tab === 'GROUP' && (
          <div>
            <Label htmlFor="new-group-name">{t('messaging:newConversationModal.groupNameLabel')}</Label>
            <Input
              id="new-group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t('messaging:newConversationModal.groupNamePlaceholder')}
              maxLength={200}
            />
          </div>
        )}

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('messaging:newConversationModal.searchPlaceholder')}
            className="pl-9"
          />
        </div>

        {tab === 'GROUP' && selectedGroupUserIds.length > 0 && (
          <p className="text-xs font-medium text-slate-500">
            {t('messaging:newConversationModal.selectedCount', { count: selectedGroupUserIds.length })}
          </p>
        )}

        <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-xl border border-slate-200/70 p-1.5">
          {isUsersLoading ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : candidates.length === 0 ? (
            <p className="py-6 text-center text-xs italic text-slate-400">{t('messaging:newConversationModal.noUsersFound')}</p>
          ) : tab === 'DIRECT' ? (
            candidates.map((u) => {
              const isSelected = u.id === selectedDirectUserId;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedDirectUserId(u.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors',
                    isSelected ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <Avatar name={u.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.fullName}</p>
                    <p className="truncate text-xs text-slate-400">{u.email}</p>
                  </div>
                  {isSelected && <CheckIcon className="h-4 w-4 shrink-0 text-primary-600" />}
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
                    'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors',
                    isSelected ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <Checkbox checked={isSelected} onChange={() => toggleGroupUser(u.id)} />
                  <Avatar name={u.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{u.fullName}</p>
                    <p className="truncate text-xs text-slate-400">{u.email}</p>
                  </div>
                </label>
              );
            })
          )}
        </div>

        {formError && (
          <p role="alert" className="text-xs font-medium text-rose-600">
            {formError}
          </p>
        )}
      </div>
    </Modal>
  );
}
