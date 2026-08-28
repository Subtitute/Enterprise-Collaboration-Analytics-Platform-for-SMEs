import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Select } from '@/components/ui/Input';
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

export function ShareModal({ file, onClose }: { file: FileItem | null; onClose: () => void }) {
  const { t } = useTranslation();
  const PERMISSIONS = [
    { value: 'VIEW', label: t('documents:shareModal.permissions.view') },
    { value: 'EDIT', label: t('documents:shareModal.permissions.edit') },
  ];
  const { data: users } = useOrgUsersQuery();
  const { data: departments } = useDepartmentsQuery();
  // 28/07/2026: thay `userId` rieng le bang `targetType` + `targetId` de dung chung 1 <Select> cho
  // ca 2 truong hop chia se (nguoi dung/phong ban) - xem cong tac chuyen doi ben duoi.
  const [targetType, setTargetType] = useState<ShareTargetType>('user');
  const [targetId, setTargetId] = useState('');
  const [permission, setPermission] = useState('VIEW');
  const share = useShareFile();

  function handleClose() {
    setTargetType('user');
    setTargetId('');
    setPermission('VIEW');
    onClose();
  }

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
      size="sm"
    >
      <div className="space-y-4">
        {/* 28/07/2026: cong tac dang segmented control - chuyen doi <Select> ben duoi giua danh sach
            thanh vien va danh sach phong ban, vi backend chi nhan DUNG 1 trong 2 truong
            sharedWithUserId/sharedWithDepartmentId cho moi lan chia se (mirror FolderShareModal.tsx). */}
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
            {t('documents:shareModal.targetType.user')}
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
            {t('documents:shareModal.targetType.department')}
          </button>
        </div>
        {/* 25/07/2026: them htmlFor/id (share-user, share-permission) - <Label> truoc do khong gan
            duoc voi control tuong ung, cung loi nhu TaskDetailModal.tsx, sua theo dung pattern
            NewTaskModal.tsx/InviteMemberModal.tsx dang dung. */}
        {/* 28/07/2026: doi id sang "share-target" (dung chung cho ca 2 loai) va doc du lieu tu
            users/departments tuy targetType - xem giai thich tai khai bao targetType/targetId. */}
        <FormField
          label={targetType === 'user' ? t('documents:shareModal.shareWithLabel') : t('documents:shareModal.shareWithDepartmentLabel')}
          htmlFor="share-target"
          required
        >
          <Select id="share-target" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">
              {targetType === 'user' ? t('documents:shareModal.selectMemberPlaceholder') : t('documents:shareModal.selectDepartmentPlaceholder')}
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
        <FormField label={t('documents:shareModal.permissionLabel')} htmlFor="share-permission">
          <Select id="share-permission" value={permission} onChange={(e) => setPermission(e.target.value)}>
            {PERMISSIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          {/* 26/08/2026: them disabled={share.isPending} - nut Huy nay truoc do goi thang
              handleClose khong dieu kien, la 1 duong dong khong bi chan boi preventCloseWhilePending
              (prop do chi chan X/Escape/backdrop trong Modal.tsx, khong bao trum nut tu viet trong
              modal con) - mirror dung disabled đã co san o DepartmentModal.tsx/UploadModal.tsx. */}
          <Button type="button" variant="outline" onClick={handleClose} disabled={share.isPending}>
            {t('documents:shareModal.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!targetId || !file}
            isLoading={share.isPending}
            onClick={() => {
              // 28/07/2026: gui dung 1 trong 2 truong sharedWithUserId/sharedWithDepartmentId tuy
              // targetType, khop voi chu ky moi cua useShareFile()/shareFile() (api.ts).
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
}
