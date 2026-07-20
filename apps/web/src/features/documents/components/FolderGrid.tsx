import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { FolderIcon, MoreVerticalIcon, EditIcon, TrashIcon } from '@/components/ui/Icons';
import type { Folder } from '@/types';
import { useDeleteFolder, useRenameFolder } from '../hooks';

export function FolderGrid({ folders, onOpen }: { folders: Folder[]; onOpen: (folder: Folder) => void }) {
  const [renaming, setRenaming] = useState<Folder | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<Folder | null>(null);
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();

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
