import React, { useState, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ui/Modal';
// 28/07/2026: canAccessAdminArea + useAuthStore/usePermissions - can de tinh quyen quan ly
// visibility/chia se cua tung thu muc (chi nguoi tao thu muc HOAC nguoi co quyen quan tri), cung
// 1 pattern voi guard cua /admin/* (Sidebar.tsx). 17/09/2026: doi tu hasAdminRole(roles) (so khop
// TEN vai tro) sang canAccessAdminArea(permissions) (so khop QUYEN that su) - xem ghi chu chi tiet
// tai lib/utils.ts. Luu y: canAccessAdminArea() gio dung CHUNG 1 tap quyen quan tri (USER_INVITE/
// USER_MANAGE/DEPARTMENT_MANAGE/ROLE_MANAGE/CALENDAR_MANAGE/SYSTEM_MANAGE) cho MOI khu vuc quan
// tri - Manager (co san USER_INVITE) tu day cung duoc coi la "quan tri" cho muc dich quan ly
// thu muc nay, giong cach ho da vao duoc /admin/* qua chinh 1 quyen do.
import { canAccessAdminArea } from '@/lib/utils';
import { useAuthStore, usePermissions } from '@/stores/auth.store';
import type { Folder } from '@/types';
import { useDeleteFolder, useDocumentProjects, useRenameFolder, useUpdateFolderVisibility } from '../hooks';
import { DocumentFolderCard } from './DocumentFolderCard';
// 26/10/2026: hop doi du an cua thu muc cap goc (tai lieu theo pham vi du an).
import { FolderProjectModal, useIsOrgAdmin } from './FolderProjectSelect';
// 26/10/2026: an menu thao tac cua thu muc nguoi goi chi xem (cay toan cong ty).
import { canWriteFolder } from '../writeAccess';

// 28/07/2026: them onShare - callback mo FolderShareModal (quan ly chia se) tu dropdown cua tung
// thu muc, day len DocumentsPage.tsx dieu khien giong het pattern sharingFile/ShareModal hien co.
export const FolderGrid = memo(function FolderGrid({
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
  // 26/10/2026: ten du an cho nhan tren the thu muc + thu muc dang doi du an.
  const { projectNames } = useDocumentProjects();
  const [changingProject, setChangingProject] = useState<Folder | null>(null);
  // 28/07/2026: id + roles cua nguoi dang dang nhap - dung de so sanh voi folder.createdByUserId
  // (xem canManage() ben duoi).
  const currentUserId = useAuthStore((s) => s.user?.id);
  const permissions = usePermissions();
  const isOrgAdmin = useIsOrgAdmin();

  // 28/07/2026: chi nguoi tao thu muc HOAC nguoi co quyen quan tri moi duoc doi visibility/quan ly
  // chia se - mirror dung cach kiem tra dung cho cac route /admin/* (canAccessAdminArea(permissions)),
  // ket hop so sanh truc tiep createdByUserId (kiem tra o CLIENT chi de an/hien UI, backend van la
  // noi thuc thi quyen that su).
  const canManage = useCallback(
    (folder: Folder): boolean => {
      return folder.createdByUserId === currentUserId || canAccessAdminArea(permissions);
    },
    [currentUserId, permissions],
  );

  const handleRenameClick = useCallback((f: Folder) => {
    setRenaming(f);
    setRenameValue(f.name);
  }, []);

  const handleDeleteClick = useCallback((f: Folder) => {
    setDeleting(f);
  }, []);

  if (folders.length === 0) return null;

  return (
    <>
      <div className={viewMode === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'}>
        {folders.map((folder) => (
          <DocumentFolderCard
            key={folder.id}
            folder={folder}
            onOpen={onOpen}
            onShare={onShare}
            viewMode={viewMode}
            canManage={canManage}
            onRenameClick={handleRenameClick}
            onDeleteClick={handleDeleteClick}
            updateVisibility={updateVisibility}
            projectNames={projectNames}
            onChangeProjectClick={setChangingProject}
            canWrite={canWriteFolder(folder, isOrgAdmin)}
          />
        ))}
      </div>

      <FolderProjectModal key={changingProject?.id ?? 'none'} folder={changingProject} onClose={() => setChangingProject(null)} />

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
});

// Alias cho DocumentFolderTree theo yêu cầu refactor
export const DocumentFolderTree = FolderGrid;
