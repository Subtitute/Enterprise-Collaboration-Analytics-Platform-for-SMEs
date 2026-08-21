// 28/07/2026: modal moi "Quản lý chia sẻ" cho thu muc restricted (tinh nang kiem soat truy cap
// thu muc theo cap do) - mo phong cau truc ShareModal.tsx (chia se tep) nhung khac 2 diem: (a) co
// the chia se cho CA phong ban (khong chi tung nguoi dung) qua 1 cong tac "Người dùng"/"Phòng ban";
// (b) hien them danh sach da chia se (GET /folders/:id/shares) kem nut "Xoá" tung dong, vi 1 thu
// muc co the co NHIEU luot chia se cung luc (khac ShareModal.tsx chi co 1 form "chia se 1 lan").
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Select } from '@/components/ui/Input';
import { TrashIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { useOrgUsersQuery, useUserNameMap } from '@/hooks/useOrgUsers';
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useCreateFolderShare, useDeleteFolderShare, useFolderSharesQuery } from '../hooks';
import type { Folder } from '@/types';

type ShareTargetType = 'user' | 'department';

export function FolderShareModal({ folder, onClose }: { folder: Folder | null; onClose: () => void }) {
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

  function handleClose() {
    setTargetType('user');
    setTargetId('');
    onClose();
  }

  function departmentName(id: string): string {
    return departments?.find((d) => d.id === id)?.name ?? id;
  }

  const shares = sharesQuery.data ?? [];

  return (
    <Modal
      open={Boolean(folder)}
      onClose={handleClose}
      title={t('documents:folderShareModal.title', { folderName: folder?.name ?? '' })}
      size="sm"
    >
      <div className="space-y-4">
        {/* 28/07/2026: cong tac dang segmented control - chuyen doi <Select> ben duoi giua danh sach
            thanh vien va danh sach phong ban, vi backend chi nhan DUNG 1 trong 2 truong
            sharedWithUserId/sharedWithDepartmentId cho moi lan chia se. */}
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              setTargetType('user');
              setTargetId('');
            }}
            className={cn(
              'flex-1 rounded-md py-1.5 font-medium transition-colors',
              targetType === 'user' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t('documents:folderShareModal.targetType.user')}
          </button>
          <button
            type="button"
            onClick={() => {
              setTargetType('department');
              setTargetId('');
            }}
            className={cn(
              'flex-1 rounded-md py-1.5 font-medium transition-colors',
              targetType === 'department' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t('documents:folderShareModal.targetType.department')}
          </button>
        </div>

        <FormField
          label={targetType === 'user' ? t('documents:folderShareModal.shareWithMemberLabel') : t('documents:folderShareModal.shareWithDepartmentLabel')}
          htmlFor="folder-share-target"
        >
          <Select id="folder-share-target" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">
              {targetType === 'user' ? t('documents:folderShareModal.selectMemberPlaceholder') : t('documents:folderShareModal.selectDepartmentPlaceholder')}
            </option>
            {targetType === 'user'
              ? (users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.email})
                  </option>
                ))
              : (departments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
          </Select>
        </FormField>

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={!targetId || !folder}
            isLoading={createShare.isPending}
            onClick={() => {
              if (!folder || !targetId) return;
              const payload = targetType === 'user' ? { sharedWithUserId: targetId } : { sharedWithDepartmentId: targetId };
              createShare.mutate({ folderId: folder.id, payload }, { onSuccess: () => setTargetId('') });
            }}
          >
            {t('documents:folderShareModal.addShare')}
          </Button>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{t('documents:folderShareModal.sharedWithHeading')}</p>
          {sharesQuery.isLoading ? (
            <p className="text-sm text-slate-400">{t('documents:folderShareModal.loading')}</p>
          ) : shares.length === 0 ? (
            <p className="text-sm text-slate-400">{t('documents:folderShareModal.noShares')}</p>
          ) : (
            <ul className="space-y-1.5">
              {shares.map((share) => (
                <li key={share.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="truncate text-slate-700">
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
                    className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button type="button" variant="outline" onClick={handleClose}>
            {t('documents:folderShareModal.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
