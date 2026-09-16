import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { FolderIcon, LockIcon, MoreVerticalIcon, EditIcon, ShareIcon, TrashIcon } from '@/components/ui/Icons';
// 28/07/2026: hasAdminRole + useAuthStore - can de tinh quyen quan ly visibility/chia se cua tung
// thu muc (chi nguoi tao thu muc HOAC Org Admin), cung 1 pattern voi guard cua /admin/* (Sidebar.tsx).
import { hasAdminRole, formatRelativeTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import type { Folder } from '@/types';
import { useDeleteFolder, useRenameFolder, useUpdateFolderVisibility, useFilesQuery } from '../hooks';

function FolderCardItem({
  folder,
  onOpen,
  onShare,
  viewMode,
  canManage,
  onRenameClick,
  onDeleteClick,
  updateVisibility,
}: {
  folder: Folder;
  onOpen: (folder: Folder) => void;
  onShare: (folder: Folder) => void;
  viewMode: 'grid' | 'list';
  canManage: (folder: Folder) => boolean;
  onRenameClick: (folder: Folder) => void;
  onDeleteClick: (folder: Folder) => void;
  updateVisibility: any;
}) {
  const { t } = useTranslation();
  const folderFilesQuery = useFilesQuery(folder.id);
  const fileCount = folderFilesQuery.data?.length ?? 0;
  const updatedTimeText = formatRelativeTime(folder.updatedAt || folder.createdAt);

  if (viewMode === 'list') {
    return (
      <Card
        onClick={() => onOpen(folder)}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(folder);
          }
        }}
        className="group flex items-center gap-3 transition-all duration-200 hover:shadow-md hover:border-indigo-300 px-3.5 py-3 sm:px-4 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100/80 transition-colors">
            <FolderIcon className="h-5.5 w-5.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                {folder.name}
              </span>
              {folder.visibility === 'restricted' && (
                <span
                  title={t('documents:folderGrid.restrictedTooltip')}
                  aria-label={t('documents:folderGrid.restrictedTooltip')}
                  className="inline-flex shrink-0 text-slate-400"
                >
                  <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] font-normal text-slate-500">
              {folderFilesQuery.isLoading ? (
                <span className="text-slate-400">{t('documents:folderGrid.loadingFileCount')}</span>
              ) : (
                t('documents:folderGrid.metaSummary', { count: fileCount, time: updatedTimeText })
              )}
            </p>
          </div>
        </div>
        <Dropdown
          align="right"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center -mr-1 rounded-lg text-slate-400 hover:bg-slate-100/90 hover:text-slate-700 active:scale-95 transition-all cursor-pointer"
              aria-label={t('documents:folderGrid.optionsAria')}
            >
              <MoreVerticalIcon className="h-4.5 w-4.5" />
            </button>
          )}
        >
          {({ close }) => (
            <div
              className="w-52 py-1.5 shadow-md"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRenameClick(folder);
                  close();
                }}
              >
                <EditIcon className="h-4 w-4 text-slate-500" /> {t('documents:folderGrid.rename')}
              </DropdownItem>
              {canManage(folder) && (
                <DropdownItem
                  onClick={(e) => {
                    e.stopPropagation();
                    updateVisibility.mutate({
                      id: folder.id,
                      visibility: folder.visibility === 'restricted' ? 'organization' : 'restricted',
                    });
                    close();
                  }}
                >
                  <LockIcon className="h-4 w-4 text-slate-500" />
                  {folder.visibility === 'restricted'
                    ? t('documents:folderGrid.openToOrganization')
                    : t('documents:folderGrid.restrictAccess')}
                </DropdownItem>
              )}
              {canManage(folder) && (
                <DropdownItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare(folder);
                    close();
                  }}
                >
                  <ShareIcon className="h-4 w-4 text-primary-600" /> {t('documents:folderGrid.manageSharing')}
                </DropdownItem>
              )}
              <DropdownItem
                className="text-rose-600 hover:bg-rose-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick(folder);
                  close();
                }}
              >
                <TrashIcon className="h-4 w-4 text-rose-600" /> {t('documents:folderGrid.delete')}
              </DropdownItem>
            </div>
          )}
        </Dropdown>
      </Card>
    );
  }

  // Cấu trúc dọc thoáng đãng (Grid View): Icon ở trên, Tên và Metadata ở dưới cùng, padding p-5 sm:p-6, gap-4
  return (
    <Card
      onClick={() => onOpen(folder)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(folder);
        }
      }}
      className="group flex flex-col justify-between p-5 sm:p-6 gap-4 transition-all duration-200 hover:shadow-md hover:border-indigo-300 min-h-[140px] cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="cursor-pointer">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100/80 transition-colors shadow-2xs">
            <FolderIcon className="h-6.5 w-6.5" />
          </span>
        </div>
        <Dropdown
          align="right"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center -mr-1.5 -mt-1 rounded-lg text-slate-400 hover:bg-slate-100/90 hover:text-slate-700 active:scale-95 transition-all cursor-pointer"
              aria-label={t('documents:folderGrid.optionsAria')}
            >
              <MoreVerticalIcon className="h-4.5 w-4.5" />
            </button>
          )}
        >
          {({ close }) => (
            <div
              className="w-52 py-1.5 shadow-md"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRenameClick(folder);
                  close();
                }}
              >
                <EditIcon className="h-4 w-4 text-slate-500" /> {t('documents:folderGrid.rename')}
              </DropdownItem>
              {canManage(folder) && (
                // 28/07/2026: muc "Han che truy cap"/"Mo cho ca to chuc" - chi hien voi nguoi
                // tao thu muc/Org Admin (canManage()), goi useUpdateFolderVisibility() (PATCH
                // /folders/:id { visibility }).
                <DropdownItem
                  onClick={(e) => {
                    e.stopPropagation();
                    updateVisibility.mutate({
                      id: folder.id,
                      visibility: folder.visibility === 'restricted' ? 'organization' : 'restricted',
                    });
                    close();
                  }}
                >
                  <LockIcon className="h-4 w-4 text-slate-500" />
                  {folder.visibility === 'restricted'
                    ? t('documents:folderGrid.openToOrganization')
                    : t('documents:folderGrid.restrictAccess')}
                </DropdownItem>
              )}
              {canManage(folder) && (
                // 28/07/2026: muc "Quan ly chia se" - chi hien voi thu muc restricted (tinh nang kiem
                // soat truy cap thu muc theo cap do), mo FolderShareModal qua onShare prop.
                <DropdownItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare(folder);
                    close();
                  }}
                >
                  <ShareIcon className="h-4 w-4 text-primary-600" /> {t('documents:folderGrid.manageSharing')}
                </DropdownItem>
              )}
              <DropdownItem
                className="text-rose-600 hover:bg-rose-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick(folder);
                  close();
                }}
              >
                <TrashIcon className="h-4 w-4 text-rose-600" /> {t('documents:folderGrid.delete')}
              </DropdownItem>
            </div>
          )}
        </Dropdown>
      </div>

      <div className="block w-full text-left min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate text-sm sm:text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors block flex-1" title={folder.name}>
            {folder.name}
          </span>
          {folder.visibility === 'restricted' && (
            // 28/07/2026: chi bao truc quan cho thu muc "restricted" (tinh nang kiem soat truy
            // cap thu muc theo cap do) - dat title (hover) + aria-label tren <span> BOC NGOAI
            // (IconProps/SVGProps khong co thuoc tinh HTML "title"), dung pattern da ap dung
            // cung ngay hom nay cho Avatar.tsx (title+aria-label tren phan tu container); icon
            // ben trong danh aria-hidden de tranh trinh doc man hinh cong bo trung lap.
            <span
              title={t('documents:folderGrid.restrictedTooltip')}
              aria-label={t('documents:folderGrid.restrictedTooltip')}
              className="inline-flex shrink-0 text-slate-400"
            >
              <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          )}
        </div>
        {/* Siêu dữ liệu Metadata: Số lượng tệp tin & Thời gian cập nhật */}
        <p className="mt-1 truncate text-xs font-normal text-slate-500">
          {folderFilesQuery.isLoading ? (
            <span className="text-slate-400">{t('documents:folderGrid.loadingFileCount')}</span>
          ) : (
            t('documents:folderGrid.metaSummary', { count: fileCount, time: updatedTimeText })
          )}
        </p>
      </div>
    </Card>
  );
}

// 28/07/2026: them onShare - callback mo FolderShareModal (quan ly chia se) tu dropdown cua tung
// thu muc, day len DocumentsPage.tsx dieu khien giong het pattern sharingFile/ShareModal hien co.
export function FolderGrid({
  folders,
  onOpen,
  onShare,
  viewMode = 'grid',
}: {
  folders: Folder[];
  onOpen: (folder: Folder) => void;
  onShare: (folder: Folder) => void;
  viewMode?: 'grid' | 'list';
}) {
  const { t } = useTranslation();
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
      <div className={viewMode === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'}>
        {folders.map((folder) => (
          <FolderCardItem
            key={folder.id}
            folder={folder}
            onOpen={onOpen}
            onShare={onShare}
            viewMode={viewMode}
            canManage={canManage}
            onRenameClick={(f) => {
              setRenaming(f);
              setRenameValue(f.name);
            }}
            onDeleteClick={(f) => setDeleting(f)}
            updateVisibility={updateVisibility}
          />
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
          title={t('documents:folderGrid.renameDialog.title')}
          confirmLabel={t('documents:folderGrid.renameDialog.confirmLabel')}
        >
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            // 28/07/2026: them aria-label (phat hien qua ra soat kha nang tiep can) - input nay
            // khong co <label> nao gan voi no, truoc do trinh doc man hinh chi doc "edit text",
            // khong biet muc dich cua o nhap nay la gi.
            aria-label={t('documents:folderGrid.renameDialog.inputAria')}
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
        title={t('documents:folderGrid.deleteConfirm.title')}
        description={deleting ? t('documents:folderGrid.deleteConfirm.description', { name: deleting.name }) : undefined}
        confirmLabel={t('documents:folderGrid.deleteConfirm.confirmLabel')}
        danger
      />
    </>
  );
}
