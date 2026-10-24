import { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { TrashIcon, SearchIcon, BuildingIcon, CheckIcon, UserIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { useOrgUsersQuery, useUserNameMap } from '@/hooks/useOrgUsers';
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useCreateFolderShare, useDeleteFolderShare, useFolderSharesQuery } from '../hooks';
import type { Folder } from '@/types';

type ShareTargetType = 'user' | 'department';

export const FolderShareModal = memo(function FolderShareModal({ folder, onClose }: { folder: Folder | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: users } = useOrgUsersQuery();
  const { data: departments } = useDepartmentsQuery();
  // 28/07/2026: useUserNameMap() - dung de quy doi sharedWithUserId -> ten hien thi tren tung dong
  // chia se, cung 1 hook TaskDetailModal.tsx dang dung de quy doi actorId/assigneeId -> ten.
  const { map: userNames } = useUserNameMap();
  const sharesQuery = useFolderSharesQuery(folder?.id);
  const createShare = useCreateFolderShare();
  const deleteShare = useDeleteFolderShare();

  const [targetType, setTargetType] = useState<ShareTargetType>('user');
  const [targetId, setTargetId] = useState('');
  const [search, setSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  function handleClose() {
    setTargetType('user');
    setTargetId('');
    setSearch('');
    setIsDropdownOpen(false);
    onClose();
  }

  function departmentName(id: string): string {
    return departments?.find((d) => d.id === id)?.name ?? id;
  }

  const selectedUser = useMemo(() => {
    if (targetType !== 'user' || !targetId) return null;
    return users?.find((u) => u.id === targetId) ?? null;
  }, [targetType, targetId, users]);

  const selectedDept = useMemo(() => {
    if (targetType !== 'department' || !targetId) return null;
    return departments?.find((d) => d.id === targetId) ?? null;
  }, [targetType, targetId, departments]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) => u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, search]);

  const filteredDepts = useMemo(() => {
    if (!departments) return [];
    if (!search.trim()) return departments;
    const q = search.toLowerCase();
    return departments.filter((d) => d.name?.toLowerCase().includes(q));
  }, [departments, search]);

  const shares = sharesQuery.data ?? [];

  return (
    <Modal
      open={Boolean(folder)}
      onClose={handleClose}
      title={t('documents:folderShareModal.title', { folderName: folder?.name ?? '' })}
      size="md"
    >
      <div className="space-y-4 pb-2">
        {/* 28/07/2026: cong tac dang segmented control - chuyen doi <Select> ben duoi giua danh sach
            thanh vien va danh sach phong ban, vi backend chi nhan DUNG 1 trong 2 truong
            sharedWithUserId/sharedWithDepartmentId cho moi lan chia se. */}
        {/* Segmented Control Người dùng / Phòng ban */}
        <div className="flex h-9 rounded-radius-md bg-bg-subtle p-0.5 text-[12px]">
          <button
            type="button"
            onClick={() => {
              setTargetType('user');
              setTargetId('');
              setSearch('');
              setIsDropdownOpen(false);
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-radius-sm font-medium transition-colors cursor-pointer',
              targetType === 'user'
                ? 'bg-white text-text-primary border border-border-subtle font-semibold shadow-xs'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <UserIcon className="h-3.5 w-3.5 stroke-1.5" />
            {t('documents:folderShareModal.targetType.user')}
          </button>
          <button
            type="button"
            onClick={() => {
              setTargetType('department');
              setTargetId('');
              setSearch('');
              setIsDropdownOpen(false);
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-radius-sm font-medium transition-colors cursor-pointer',
              targetType === 'department'
                ? 'bg-white text-text-primary border border-border-subtle font-semibold shadow-xs'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <BuildingIcon className="h-3.5 w-3.5 stroke-1.5" />
            {t('documents:folderShareModal.targetType.department')}
          </button>
        </div>

        {/* Custom Selector Picker */}
        <div className="relative">
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
            {targetType === 'user'
              ? t('documents:folderShareModal.shareWithMemberLabel')
              : t('documents:folderShareModal.shareWithDepartmentLabel')}
          </label>

          <div className="relative">
            {targetType === 'user' && selectedUser && !isDropdownOpen ? (
              <div
                onClick={() => setIsDropdownOpen(true)}
                className="flex items-center justify-between rounded-radius-sm border border-border-strong bg-bg-subtle px-3 py-2 cursor-pointer hover:border-accent transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={selectedUser.fullName} size="sm" className="h-6 w-6 text-[10px]" />
                  <div>
                    <span className="block text-[13px] font-medium text-text-primary">{selectedUser.fullName}</span>
                    <span className="block text-[11px] font-mono text-text-tertiary tabular-nums">{selectedUser.email}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(true);
                  }}
                  className="text-[12px] text-accent hover:underline cursor-pointer font-medium"
                >
                  {t('documents:shareTargetPicker.change')}
                </button>
              </div>
            ) : targetType === 'department' && selectedDept && !isDropdownOpen ? (
              <div
                onClick={() => setIsDropdownOpen(true)}
                className="flex items-center justify-between rounded-radius-sm border border-border-strong bg-bg-subtle px-3 py-2 cursor-pointer hover:border-accent transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-radius-sm bg-accent-soft text-accent">
                    <BuildingIcon className="h-3.5 w-3.5 stroke-1.5" />
                  </span>
                  <span className="text-[13px] font-medium text-text-primary">{selectedDept.name}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(true);
                  }}
                  className="text-[12px] text-accent hover:underline cursor-pointer font-medium"
                >
                  {t('documents:shareTargetPicker.change')}
                </button>
              </div>
            ) : (
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  value={search}
                  autoFocus={isDropdownOpen}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  placeholder={
                    targetType === 'user'
                      ? t('documents:folderShareModal.selectMemberPlaceholder')
                      : t('documents:folderShareModal.selectDepartmentPlaceholder')
                  }
                  className="h-9 w-full rounded-radius-sm border border-border-strong bg-white pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
                />
              </div>
            )}

            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} aria-hidden />
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-radius-md border border-border-subtle bg-white p-1 shadow-md">
                  {targetType === 'user' ? (
                    filteredUsers.length === 0 ? (
                      <p className="px-3 py-2 text-center text-[12px] text-text-tertiary">{t('documents:shareTargetPicker.noMembersFound')}</p>
                    ) : (
                      filteredUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setTargetId(u.id);
                            setIsDropdownOpen(false);
                            setSearch('');
                          }}
                          className="flex w-full items-center justify-between rounded-radius-sm px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-bg-subtle cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar name={u.fullName} size="sm" className="h-6 w-6 text-[10px]" />
                            <div>
                              <p className="font-medium text-text-primary">{u.fullName}</p>
                              <p className="text-[10px] font-mono text-text-tertiary tabular-nums">{u.email}</p>
                            </div>
                          </div>
                          {targetId === u.id && <CheckIcon className="h-4 w-4 text-[#2F6F44]" />}
                        </button>
                      ))
                    )
                  ) : filteredDepts.length === 0 ? (
                    <p className="px-3 py-2 text-center text-[12px] text-text-tertiary">{t('documents:shareTargetPicker.noDepartmentsFound')}</p>
                  ) : (
                    filteredDepts.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setTargetId(d.id);
                          setIsDropdownOpen(false);
                          setSearch('');
                        }}
                        className="flex w-full items-center justify-between rounded-radius-sm px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-bg-subtle cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-radius-sm bg-accent-soft text-accent">
                            <BuildingIcon className="h-3.5 w-3.5 stroke-1.5" />
                          </span>
                          <p className="font-medium text-text-primary">{d.name}</p>
                        </div>
                        {targetId === d.id && <CheckIcon className="h-4 w-4 text-[#2F6F44]" />}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={!targetId || !folder}
            isLoading={createShare.isPending}
            className="h-8 rounded-radius-sm bg-text-primary hover:bg-black text-[12px] font-medium"
            onClick={() => {
              if (!folder || !targetId) return;
              const payload = targetType === 'user' ? { sharedWithUserId: targetId } : { sharedWithDepartmentId: targetId };
              createShare.mutate({ folderId: folder.id, payload }, { onSuccess: () => setTargetId('') });
            }}
          >
            {t('documents:folderShareModal.addShare')}
          </Button>
        </div>

        <div className="border-t border-border-subtle pt-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-tertiary">{t('documents:folderShareModal.sharedWithHeading')}</p>
          {sharesQuery.isLoading ? (
            <p className="text-[13px] text-text-tertiary">{t('documents:folderShareModal.loading')}</p>
          ) : shares.length === 0 ? (
            <p className="text-[13px] text-text-tertiary">{t('documents:folderShareModal.noShares')}</p>
          ) : (
            <ul className="space-y-1.5">
              {shares.map((share) => (
                <li key={share.id} className="flex items-center justify-between gap-2 rounded-radius-sm bg-bg-subtle px-3 py-2 text-[13px]">
                  <span className="truncate text-text-primary font-medium">
                    {share.sharedWithUserId
                      ? (userNames[share.sharedWithUserId] ?? share.sharedWithUserId)
                      : share.sharedWithDepartmentId
                        ? departmentName(share.sharedWithDepartmentId)
                        : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => folder && deleteShare.mutate({ folderId: folder.id, shareId: share.id })}
                    aria-label={t('documents:folderShareModal.deleteShareAria')}
                    className="shrink-0 rounded-radius-sm p-1 text-text-tertiary hover:bg-[#F8E5E3] hover:text-[#B3261E] transition-colors cursor-pointer"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-border-subtle mt-4">
          <Button type="button" variant="outline" onClick={handleClose} className="h-9 rounded-radius-sm border-border-strong text-[13px]">
            {t('documents:folderShareModal.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
});
