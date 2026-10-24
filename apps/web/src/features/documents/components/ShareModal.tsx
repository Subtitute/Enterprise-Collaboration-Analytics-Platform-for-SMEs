import { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { SearchIcon, BuildingIcon, CheckIcon, UserIcon, EyeIcon, EditIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
// 28/07/2026: useDepartmentsQuery - can them de ho tro chia se tep cho CA phong ban (khong chi
// tung nguoi dung nhu truoc), cung 1 hook admin/hooks.ts dang dung cho trang Quan tri > Phong ban.
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useShareFile } from '../hooks';
import type { FileItem } from '@/types';

// 28/07/2026: kieu doi tuong nhan chia se - dung cho cong tac "Người dùng"/"Phòng ban" ben duoi
// (tinh nang kiem soat truy cap thu muc/tep theo cap do, mo rong chia se sang ca phong ban).
type ShareTargetType = 'user' | 'department';

export const ShareModal = memo(function ShareModal({ file, onClose }: { file: FileItem | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: users } = useOrgUsersQuery();
  const { data: departments } = useDepartmentsQuery();
  // 28/07/2026: thay `userId` rieng le bang `targetType` + `targetId` de dung chung 1 <Select> cho
  // ca 2 truong hop chia se (nguoi dung/phong ban) - xem cong tac chuyen doi ben duoi.
  const [targetType, setTargetType] = useState<ShareTargetType>('user');
  const [targetId, setTargetId] = useState('');
  const [permission, setPermission] = useState('VIEW');
  const [search, setSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const share = useShareFile();

  function handleClose() {
    setTargetType('user');
    setTargetId('');
    setPermission('VIEW');
    setSearch('');
    setIsDropdownOpen(false);
    onClose();
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

  return (
    <Modal
      open={Boolean(file)}
      onClose={handleClose}
      // 26/08/2026: modal nay keyed theo `file` (giong het EditMemberModal keyed theo `user`) -
      // share.mutate() ben duoi goi onSuccess: handleClose, nen dong+mo lai modal cho 1 file KHAC
      // trong luc mutation cu con dang bay se bi onSuccess cu dong nham. Chan bang prop dung chung
      // cua Modal.tsx, cung ly do da sua o EditMemberModal.tsx hom qua.
      preventCloseWhilePending={share.isPending}
      title={t('documents:shareModal.title', { fileName: file?.name ?? '' })}
      size="md"
    >
      <div className="space-y-4">
        {/* 28/07/2026: cong tac dang segmented control - chuyen doi <Select> ben duoi giua danh sach
            thanh vien va danh sach phong ban, vi backend chi nhan DUNG 1 trong 2 truong
            sharedWithUserId/sharedWithDepartmentId cho moi lan chia se (mirror FolderShareModal.tsx). */}
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
            {t('documents:shareModal.targetType.user')}
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
            {t('documents:shareModal.targetType.department')}
          </button>
        </div>

        {/* Custom Selector Picker */}
        <div className="relative">
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5" htmlFor="share-target-select">
            {targetType === 'user' ? t('documents:shareModal.shareWithLabel') : t('documents:shareModal.shareWithDepartmentLabel')}
          </label>
          <select
            id="share-target-select"
            aria-label={t('documents:shareModal.shareWithLabel')}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="sr-only"
            tabIndex={-1}
          >
            <option value="">{t('documents:shareModal.selectMemberPlaceholder')}</option>
            {targetType === 'user'
              ? (users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName || u.email}
                  </option>
                ))
              : (departments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
          </select>

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
                      ? t('documents:shareModal.selectMemberPlaceholder')
                      : t('documents:shareModal.selectDepartmentPlaceholder')
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

        {/* Quyền truy cập dạng Segmented Control phẳng (nền bg-subtle, active nền trắng + Ink w600, KHÔNG viền 2px) */}
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
            {t('documents:shareModal.permissionLabel')}
          </label>
          <div className="flex h-9 rounded-radius-md bg-bg-subtle p-0.5 text-[12px]">
            <button
              type="button"
              onClick={() => setPermission('VIEW')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-radius-sm font-medium transition-colors cursor-pointer',
                permission === 'VIEW'
                  ? 'bg-white text-text-primary border border-border-subtle font-semibold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <EyeIcon className="h-3.5 w-3.5 stroke-1.5" />
              <span>{t('documents:shareModal.permissions.view')}</span>
            </button>
            <button
              type="button"
              onClick={() => setPermission('EDIT')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-radius-sm font-medium transition-colors cursor-pointer',
                permission === 'EDIT'
                  ? 'bg-white text-text-primary border border-border-subtle font-semibold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <EditIcon className="h-3.5 w-3.5 stroke-1.5" />
              <span>{t('documents:shareModal.permissions.edit')}</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border-subtle pt-3 mt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={share.isPending} className="h-9 rounded-radius-sm border-border-strong text-[13px]">
            {t('documents:shareModal.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!targetId || !file}
            isLoading={share.isPending}
            className="h-9 rounded-radius-sm bg-text-primary hover:bg-black text-[13px] font-medium"
            onClick={() => {
              if (!file || !targetId) return;
              const target = targetType === 'user' ? { sharedWithUserId: targetId } : { sharedWithDepartmentId: targetId };
              share.mutate({ fileId: file.id, ...target, permission }, { onSuccess: handleClose });
            }}
          >
            {t('documents:shareModal.submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
});

export const DocumentShareModal = ShareModal;
