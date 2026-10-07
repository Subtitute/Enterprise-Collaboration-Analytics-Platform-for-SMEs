import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { FolderIcon, LockIcon, MoreVerticalIcon, EditIcon, ShareIcon, TrashIcon } from '@/components/ui/Icons';
// 28/07/2026: canAccessAdminArea + useAuthStore/usePermissions - can de tinh quyen quan ly
// visibility/chia se cua tung thu muc (chi nguoi tao thu muc HOAC nguoi co quyen quan tri), cung
// 1 pattern voi guard cua /admin/* (Sidebar.tsx). 17/09/2026: doi tu hasAdminRole(roles) (so khop
// TEN vai tro) sang canAccessAdminArea(permissions) (so khop QUYEN that su) - xem ghi chu chi tiet
// tai lib/utils.ts. Luu y: canAccessAdminArea() gio dung CHUNG 1 tap quyen quan tri (USER_INVITE/
// USER_MANAGE/DEPARTMENT_MANAGE/ROLE_MANAGE/CALENDAR_MANAGE/SYSTEM_MANAGE) cho MOI khu vuc quan
// tri - Manager (co san USER_INVITE) tu day cung duoc coi la "quan tri" cho muc dich quan ly
// thu muc nay, giong cach ho da vao duoc /admin/* qua chinh 1 quyen do.
import { canAccessAdminArea, formatRelativeTime } from '@/lib/utils';
import { useAuthStore, usePermissions } from '@/stores/auth.store';
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
      <div
        onClick={() => onOpen(folder)}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(folder);
          }
        }}
        className="group flex h-16 items-center justify-between px-4 rounded-radius-md border border-border-subtle bg-white transition-colors hover:border-border-strong cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-radius-md bg-accent-soft text-accent transition-colors">
            <FolderIcon className="h-5 w-5 stroke-1.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-[13px] font-medium text-text-primary group-hover:text-accent transition-colors">
                {folder.name}
              </span>
              {folder.visibility === 'restricted' && (
                <span
                  title={t('documents:folderGrid.restrictedTooltip')}
                  aria-label={t('documents:folderGrid.restrictedTooltip')}
                  className="inline-flex shrink-0 text-text-tertiary"
                >
                  <LockIcon className="h-3.5 w-3.5 stroke-1.5" aria-hidden="true" />
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[12px] font-normal text-text-tertiary">
              {folderFilesQuery.isLoading ? (
                <span className="text-text-tertiary">{t('documents:folderGrid.loadingFileCount')}</span>
              ) : (
                <>
                  <span className="font-mono tabular-nums">{fileCount}</span> {t('documents:folderGrid.filesSuffix', 'tệp')} • <span className="font-mono tabular-nums">{updatedTimeText}</span>
                </>
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
              className="flex h-6 w-6 shrink-0 items-center justify-center -mr-1 rounded-radius-sm text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
              aria-label={t('documents:folderGrid.optionsAria')}
            >
              <MoreVerticalIcon className="h-4 w-4" />
            </button>
          )}
        >
          {({ close }) => (
            <div
              className="min-w-[200px] p-1 rounded-radius-md border border-border-subtle bg-white shadow-md"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownItem
                className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onRenameClick(folder);
                  close();
                }}
              >
                <EditIcon className="h-4 w-4 text-text-secondary" /> {t('documents:folderGrid.rename')}
              </DropdownItem>
              {canManage(folder) && (
                <DropdownItem
                  className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateVisibility.mutate({
                      id: folder.id,
                      visibility: folder.visibility === 'restricted' ? 'organization' : 'restricted',
                    });
                    close();
                  }}
                >
                  <LockIcon className="h-4 w-4 text-text-secondary" />
                  {folder.visibility === 'restricted'
                    ? t('documents:folderGrid.openToOrganization')
                    : t('documents:folderGrid.restrictAccess')}
                </DropdownItem>
              )}
              {canManage(folder) && (
                <DropdownItem
                  className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare(folder);
                    close();
                  }}
                >
                  <ShareIcon className="h-4 w-4 text-text-secondary" /> {t('documents:folderGrid.manageSharing')}
                </DropdownItem>
              )}
              <DropdownItem
                className="h-9 px-2.5 rounded-radius-sm text-[13px] text-[#B3261E] hover:bg-[#F8E5E3]"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick(folder);
                  close();
                }}
              >
                <TrashIcon className="h-4 w-4 text-[#B3261E]" /> {t('documents:folderGrid.delete')}
              </DropdownItem>
            </div>
          )}
        </Dropdown>
      </div>
    );
  }

  // Grid View: Nền bg-surface, border 1 border-subtle, radius 8, p-5. Không shadow. Hover border-strong.
  return (
    <div
      onClick={() => onOpen(folder)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(folder);
        }
      }}
      className="group flex flex-col justify-between p-5 rounded-radius-lg border border-border-subtle bg-white transition-colors hover:border-border-strong cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-radius-md bg-accent-soft text-accent transition-colors">
          <FolderIcon className="h-5 w-5 stroke-1.5" />
        </span>
        <Dropdown
          align="right"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center -mr-1 -mt-1 rounded-radius-sm text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
              aria-label={t('documents:folderGrid.optionsAria')}
            >
              <MoreVerticalIcon className="h-4 w-4" />
            </button>
          )}
        >
          {({ close }) => (
            <div
              className="min-w-[200px] p-1 rounded-radius-md border border-border-subtle bg-white shadow-md"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownItem
                className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onRenameClick(folder);
                  close();
                }}
              >
                <EditIcon className="h-4 w-4 text-text-secondary" /> {t('documents:folderGrid.rename')}
              </DropdownItem>
              {canManage(folder) && (
                <DropdownItem
                  className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateVisibility.mutate({
                      id: folder.id,
                      visibility: folder.visibility === 'restricted' ? 'organization' : 'restricted',
                    });
                    close();
                  }}
                >
                  <LockIcon className="h-4 w-4 text-text-secondary" />
                  {folder.visibility === 'restricted'
                    ? t('documents:folderGrid.openToOrganization')
                    : t('documents:folderGrid.restrictAccess')}
                </DropdownItem>
              )}
              {canManage(folder) && (
                <DropdownItem
                  className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare(folder);
                    close();
                  }}
                >
                  <ShareIcon className="h-4 w-4 text-text-secondary" /> {t('documents:folderGrid.manageSharing')}
                </DropdownItem>
              )}
              <DropdownItem
                className="h-9 px-2.5 rounded-radius-sm text-[13px] text-[#B3261E] hover:bg-[#F8E5E3]"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick(folder);
                  close();
                }}
              >
                <TrashIcon className="h-4 w-4 text-[#B3261E]" /> {t('documents:folderGrid.delete')}
              </DropdownItem>
            </div>
          )}
        </Dropdown>
      </div>

      <div className="mt-3 block w-full text-left min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="line-clamp-2 text-[14px] leading-5 font-semibold text-text-primary group-hover:text-accent transition-colors block flex-1" title={folder.name}>
            {folder.name}
          </span>
          {folder.visibility === 'restricted' && (
            <span
              title={t('documents:folderGrid.restrictedTooltip')}
              aria-label={t('documents:folderGrid.restrictedTooltip')}
              className="inline-flex shrink-0 text-text-tertiary"
            >
              <LockIcon className="h-3.5 w-3.5 stroke-1.5" aria-hidden="true" />
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-[13px] leading-5 font-normal text-text-tertiary">
          {folderFilesQuery.isLoading ? (
            <span className="text-text-tertiary">{t('documents:folderGrid.loadingFileCount')}</span>
          ) : (
            <>
              <span className="font-mono tabular-nums">{fileCount}</span> {t('documents:folderGrid.filesSuffix', 'tệp')} • <span className="font-mono tabular-nums">{updatedTimeText}</span>
            </>
          )}
        </p>
      </div>
    </div>
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
  const permissions = usePermissions();

  // 28/07/2026: chi nguoi tao thu muc HOAC nguoi co quyen quan tri moi duoc doi visibility/quan ly
  // chia se - mirror dung cach kiem tra dung cho cac route /admin/* (canAccessAdminArea(permissions)),
  // ket hop so sanh truc tiep createdByUserId (kiem tra o CLIENT chi de an/hien UI, backend van la
  // noi thuc thi quyen that su).
  function canManage(folder: Folder): boolean {
    return folder.createdByUserId === currentUserId || canAccessAdminArea(permissions);
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
            className="mb-3 block h-9 w-full rounded-radius-sm border border-border-strong bg-white px-3 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
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
