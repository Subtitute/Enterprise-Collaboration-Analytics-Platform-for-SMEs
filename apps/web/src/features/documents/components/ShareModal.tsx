import { useState, useMemo } from 'react';
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

export function ShareModal({ file, onClose }: { file: FileItem | null; onClose: () => void }) {
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
        <div className="flex gap-1 rounded-xl bg-slate-100/80 p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setTargetType('user');
              setTargetId('');
              setSearch('');
              setIsDropdownOpen(false);
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-semibold transition-all cursor-pointer',
              targetType === 'user' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <UserIcon className="h-3.5 w-3.5" />
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
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-semibold transition-all cursor-pointer',
              targetType === 'department' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            <BuildingIcon className="h-3.5 w-3.5" />
            {t('documents:shareModal.targetType.department')}
          </button>
        </div>

        {/* Custom Selector Picker ăn nhập với toàn bộ phong cách đồ án */}
        <div className="relative">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            {targetType === 'user' ? t('documents:shareModal.shareWithLabel') : t('documents:shareModal.shareWithDepartmentLabel')}
          </label>

          <div className="relative">
            {targetType === 'user' && selectedUser && !isDropdownOpen ? (
              <div
                onClick={() => setIsDropdownOpen(true)}
                className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 cursor-pointer hover:border-primary-400 hover:bg-slate-100/70 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={selectedUser.fullName} size="sm" className="h-6 w-6 text-[10px]" />
                  <div>
                    <span className="block text-xs font-bold text-slate-900">{selectedUser.fullName}</span>
                    <span className="block text-[11px] text-slate-500">{selectedUser.email}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(true);
                  }}
                  className="text-xs text-primary-600 hover:underline cursor-pointer font-medium"
                >
                  Thay đổi
                </button>
              </div>
            ) : targetType === 'department' && selectedDept && !isDropdownOpen ? (
              <div
                onClick={() => setIsDropdownOpen(true)}
                className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 cursor-pointer hover:border-primary-400 hover:bg-slate-100/70 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <BuildingIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-bold text-slate-900">{selectedDept.name}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen(true);
                  }}
                  className="text-xs text-primary-600 hover:underline cursor-pointer font-medium"
                >
                  Thay đổi
                </button>
              </div>
            ) : (
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
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
                  className="h-9 w-full rounded-xl border border-slate-200/80 bg-white pl-9 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
            )}

            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} aria-hidden />
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-200/80">
                  {targetType === 'user' ? (
                    filteredUsers.length === 0 ? (
                      <p className="px-3 py-2 text-center text-xs text-slate-400">Không tìm thấy thành viên</p>
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
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-slate-50 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar name={u.fullName} size="sm" className="h-6 w-6 text-[10px]" />
                            <div>
                              <p className="font-semibold text-slate-900">{u.fullName}</p>
                              <p className="text-[10px] text-slate-400">{u.email}</p>
                            </div>
                          </div>
                          {targetId === u.id && <CheckIcon className="h-4 w-4 text-emerald-600" />}
                        </button>
                      ))
                    )
                  ) : filteredDepts.length === 0 ? (
                    <p className="px-3 py-2 text-center text-xs text-slate-400">Không tìm thấy phòng ban</p>
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
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-slate-50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                            <BuildingIcon className="h-3.5 w-3.5" />
                          </span>
                          <p className="font-semibold text-slate-900">{d.name}</p>
                        </div>
                        {targetId === d.id && <CheckIcon className="h-4 w-4 text-emerald-600" />}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quyền truy cập dạng Segmented Control bo góc hiện đại */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            {t('documents:shareModal.permissionLabel')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPermission('VIEW')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all cursor-pointer',
                permission === 'VIEW'
                  ? 'border-primary-500 bg-primary-50/70 text-primary-700 ring-2 ring-primary-100 font-bold shadow-2xs'
                  : 'border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <EyeIcon className="h-4 w-4 text-primary-600" />
              <span>{t('documents:shareModal.permissions.view')}</span>
            </button>
            <button
              type="button"
              onClick={() => setPermission('EDIT')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all cursor-pointer',
                permission === 'EDIT'
                  ? 'border-indigo-500 bg-indigo-50/70 text-indigo-700 ring-2 ring-indigo-100 font-bold shadow-2xs'
                  : 'border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <EditIcon className="h-4 w-4 text-indigo-600" />
              <span>{t('documents:shareModal.permissions.edit')}</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 mt-4">
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
