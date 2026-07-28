import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { FolderIcon, LockIcon, MoreVerticalIcon, EditIcon, ShareIcon, TrashIcon } from '@/components/ui/Icons';
// 28/07/2026: hasAdminRole + useAuthStore - can de tinh quyen quan ly visibility/chia se cua tung
// thu muc (chi nguoi tao thu muc HOAC Org Admin), cung 1 pattern voi guard cua /admin/* (Sidebar.tsx).
import { hasAdminRole } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import type { Folder } from '@/types';
import { useDeleteFolder, useRenameFolder, useUpdateFolderVisibility } from '../hooks';

// 28/07/2026: them onShare - callback mo FolderShareModal (quan ly chia se) tu dropdown cua tung
// thu muc, day len DocumentsPage.tsx dieu khien giong het pattern sharingFile/ShareModal hien co.
export function FolderGrid({ folders, onOpen, onShare }: { folders: Folder[]; onOpen: (folder: Folder) => void; onShare: (folder: Folder) => void }) {
  const [renaming, setRenaming] = useState<Folder | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<Folder | null>(null);
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const updateVisibility = useUpdateFolderVisibility();
  // 28/07/2026: id + roles cua nguoi dang dang nhap - dung de so sanh voi folder.createdByUserId
  // (xem canManage() ben duoi).
  const currentUserId = useAuthStore((s) => s.user?.id);
  const roles = useAuthStore((s) => s.user?.roles);

  // 28/07/2026: chi nguoi tao thu muc HOAC Org Admin moi duoc doi visibility/quan ly chia se - mirror
  // dung cach kiem tra "la Org Admin" da dung cho cac route /admin/* (hasAdminRole(roles)), ket hop
  // so sanh truc tiep createdByUserId (kiem tra o CLIENT chi de an/hien UI, backend van la noi thuc
  // thi quyen that su).
  function canManage(folder: Folder): boolean {
    return folder.createdByUserId === currentUserId || hasAdminRole(roles);
  }

  if (folders.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {folders.map((folder) => (
          <Card key={folder.id} className="flex items-center gap-3 p-3.5">
            <button onClick={() => onOpen(folder)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                <FolderIcon className="h-5 w-5" />
              </span>
              <span className="truncate text-sm font-medium text-slate-800">{folder.name}</span>
              {folder.visibility === 'restricted' && (
                // 28/07/2026: chi bao truc quan cho thu muc "restricted" (tinh nang kiem soat truy
                // cap thu muc theo cap do) - dat title (hover) + aria-label tren <span> BOC NGOAI
                // (IconProps/SVGProps khong co thuoc tinh HTML "title"), dung pattern da ap dung
                // cung ngay hom nay cho Avatar.tsx (title+aria-label tren phan tu container); icon
                // ben trong danh aria-hidden de tranh trinh doc man hinh cong bo trung lap.
                <span title="Thư mục hạn chế truy cập" aria-label="Thư mục hạn chế truy cập" className="inline-flex shrink-0 text-slate-400">
                  <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              )}
            </button>
            <Dropdown
              trigger={({ toggle }) => (
                <button onClick={toggle} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Tùy chọn thư mục">
                  <MoreVerticalIcon className="h-4 w-4" />
                </button>
              )}
            >
              {({ close }) => (
                <div className="w-44 py-1.5">
                  <DropdownItem
                    onClick={() => {
                      setRenaming(folder);
                      setRenameValue(folder.name);
                      close();
                    }}
                  >
                    <EditIcon className="h-4 w-4" /> Đổi tên
                  </DropdownItem>
                  {canManage(folder) && (
                    // 28/07/2026: muc "Han che truy cap"/"Mo cho ca to chuc" - chi hien voi nguoi
                    // tao thu muc/Org Admin (canManage()), goi useUpdateFolderVisibility() (PATCH
                    // /folders/:id { visibility }).
                    <DropdownItem
                      onClick={() => {
                        updateVisibility.mutate({
                          id: folder.id,
                          visibility: folder.visibility === 'restricted' ? 'organization' : 'restricted',
                        });
                        close();
                      }}
                    >
                      <LockIcon className="h-4 w-4" />
                      {folder.visibility === 'restricted' ? 'Mở cho cả tổ chức' : 'Hạn chế truy cập'}
                    </DropdownItem>
                  )}
                  {canManage(folder) && folder.visibility === 'restricted' && (
                    // 28/07/2026: "Quan ly chia se" chi co y nghia voi thu muc DA restricted (chia
                    // se tren thu muc mo cho ca to chuc la thua) - mo FolderShareModal qua onShare().
                    <DropdownItem
                      onClick={() => {
                        onShare(folder);
                        close();
                      }}
                    >
                      <ShareIcon className="h-4 w-4" /> Quản lý chia sẻ
                    </DropdownItem>
                  )}
                  <DropdownItem
                    className="text-rose-600 hover:bg-rose-50"
                    onClick={() => {
                      setDeleting(folder);
                      close();
                    }}
                  >
                    <TrashIcon className="h-4 w-4" /> Xoá thư mục
                  </DropdownItem>
                </div>
              )}
            </Dropdown>
          </Card>
        ))}
      </div>

      {renaming && (
        <ConfirmDialog
          open={Boolean(renaming)}
          onClose={() => setRenaming(null)}
          onConfirm={() => {
            if (renameValue.trim()) renameFolder.mutate({ id: renaming.id, name: renameValue.trim() });
            setRenaming(null);
          }}
          title="Đổi tên thư mục"
          confirmLabel="Lưu"
        >
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            // 28/07/2026: them aria-label (phat hien qua ra soat kha nang tiep can) - input nay
            // khong co <label> nao gan voi no, truoc do trinh doc man hinh chi doc "edit text",
            // khong biet muc dich cua o nhap nay la gi.
            aria-label="Tên thư mục mới"
            className="mb-3 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </ConfirmDialog>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteFolder.mutate(deleting.id);
          setDeleting(null);
        }}
        title="Xoá thư mục này?"
        description={deleting ? `"${deleting.name}" và toàn bộ nội dung bên trong có thể bị xoá.` : undefined}
        confirmLabel="Xoá thư mục"
        danger
      />
    </>
  );
}
