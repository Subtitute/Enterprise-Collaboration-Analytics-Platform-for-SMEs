import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { FolderIcon, LockIcon, MoreVerticalIcon, EditIcon, ShareIcon, TrashIcon } from '@/components/ui/Icons';
import { formatRelativeTime } from '@/lib/utils';
import type { Folder } from '@/types';
import { useFilesQuery } from '../hooks';
// 26/10/2026: nhan du an + doi du an cho thu muc cap goc (tai lieu theo pham vi du an).
import { FolderProjectBadge } from './FolderProjectSelect';

export interface DocumentFolderCardProps {
  folder: Folder;
  onOpen: (folder: Folder) => void;
  onShare: (folder: Folder) => void;
  viewMode: 'grid' | 'list';
  canManage: (folder: Folder) => boolean;
  onRenameClick: (folder: Folder) => void;
  onDeleteClick: (folder: Folder) => void;
  updateVisibility: any;
  // 26/10/2026: ten du an (nhan) va mo hop doi du an - chi ap dung cho thu muc cap goc.
  projectNames: Map<string, string>;
  onChangeProjectClick: (folder: Folder) => void;
  // 26/10/2026: false = nguoi goi chi xem thu muc (cay toan cong ty) - an toan bo menu thao tac (doi ten,
  // han che, chia se, doi du an, xoa deu la thao tac ghi) - xem writeAccess.ts.
  canWrite: boolean;
}

export const DocumentFolderCard = memo(function DocumentFolderCard({
  folder,
  onOpen,
  onShare,
  viewMode,
  canManage,
  onRenameClick,
  onDeleteClick,
  updateVisibility,
  projectNames,
  onChangeProjectClick,
  canWrite,
}: DocumentFolderCardProps) {
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
              <FolderProjectBadge folder={folder} projectNames={projectNames} />
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
                  <span className="font-mono tabular-nums">{fileCount}</span> {t('documents:folderGrid.filesSuffix')} • <span className="font-mono tabular-nums">{updatedTimeText}</span>
                </>
              )}
            </p>
          </div>
        </div>
        {canWrite && (
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
                {canManage(folder) && !folder.parentId && (
                  <DropdownItem
                    className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeProjectClick(folder);
                      close();
                    }}
                  >
                    <FolderIcon className="h-4 w-4 text-text-secondary" /> {t('documents:projectScope.changeProject')}
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
        )}
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
        {canWrite && (
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
                {canManage(folder) && !folder.parentId && (
                  <DropdownItem
                    className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeProjectClick(folder);
                      close();
                    }}
                  >
                    <FolderIcon className="h-4 w-4 text-text-secondary" /> {t('documents:projectScope.changeProject')}
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
        )}
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
        <div className="mt-1.5 flex min-w-0">
          <FolderProjectBadge folder={folder} projectNames={projectNames} />
        </div>
        <p className="mt-1 truncate text-[13px] leading-5 font-normal text-text-tertiary">
          {folderFilesQuery.isLoading ? (
            <span className="text-text-tertiary">{t('documents:folderGrid.loadingFileCount')}</span>
          ) : (
            <>
              <span className="font-mono tabular-nums">{fileCount}</span> {t('documents:folderGrid.filesSuffix')} • <span className="font-mono tabular-nums">{updatedTimeText}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
});

export const FolderCardItem = DocumentFolderCard;

