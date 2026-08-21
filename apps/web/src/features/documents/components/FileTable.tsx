import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { DownloadIcon, EyeIcon, FileIcon, MoreVerticalIcon, ShareIcon, ClockIcon, TrashIcon } from '@/components/ui/Icons';
import { formatBytes, formatDateTime } from '@/lib/utils';
import type { FileItem } from '@/types';
import { useDeleteFile, useDownloadFile } from '../hooks';

interface FileTableProps {
  files: FileItem[];
  folderId: string | null;
  onShare: (file: FileItem) => void;
  onVersionHistory: (file: FileItem) => void;
}

export function FileTable({ files, folderId, onShare, onVersionHistory }: FileTableProps) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState<FileItem | null>(null);
  const download = useDownloadFile();
  const deleteFile = useDeleteFile(folderId);

  return (
    <>
      <Table>
        <TableHead>
          <tr>
            <TableHeadCell>{t('documents:fileTable.columns.name')}</TableHeadCell>
            <TableHeadCell>{t('documents:fileTable.columns.size')}</TableHeadCell>
            <TableHeadCell>{t('documents:fileTable.columns.version')}</TableHeadCell>
            <TableHeadCell>{t('documents:fileTable.columns.updated')}</TableHeadCell>
            <TableHeadCell className="text-right">{t('documents:fileTable.columns.actions')}</TableHeadCell>
          </tr>
        </TableHead>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.id}>
              <TableCell label={t('documents:fileTable.columns.name')}>
                <button
                  type="button"
                  // 22/07/2026: goi download.openFile() (khong phai .mutate() truc tiep) - ham nay
                  // tu mo tab trong DONG BO ngay trong onClick truoc khi goi API, xem giai thich
                  // day du tai dinh nghia useDownloadFile() o documents/hooks.ts.
                  onClick={() => download.openFile(file.id, 'inline')}
                  title={t('documents:fileTable.openFileTitle')}
                  className="flex min-w-0 items-center gap-2.5 text-left hover:underline"
                >
                  <FileIcon className="h-4 w-4 shrink-0 text-primary-500" />
                  <span className="truncate font-medium text-slate-800">{file.name}</span>
                </button>
              </TableCell>
              <TableCell label={t('documents:fileTable.columns.size')} className="whitespace-nowrap text-xs text-slate-500">
                {formatBytes(file.size)}
              </TableCell>
              <TableCell label={t('documents:fileTable.columns.version')}>
                <Badge variant="outline">v{file.version ?? 1}</Badge>
              </TableCell>
              <TableCell label={t('documents:fileTable.columns.updated')} className="whitespace-nowrap text-xs text-slate-500">
                {formatDateTime(file.updatedAt)}
              </TableCell>
              <TableCell label={t('documents:fileTable.columns.actions')} className="text-right">
                <Dropdown
                  align="right"
                  trigger={({ toggle }) => (
                    <button
                      onClick={toggle}
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label={t('documents:fileTable.optionsAria')}
                    >
                      <MoreVerticalIcon className="h-4 w-4" />
                    </button>
                  )}
                >
                  {({ close }) => (
                    <div className="w-48 py-1.5">
                      <DropdownItem
                        // 22/07/2026: dung openFile() thay vi mutate() de window.open() chay dong
                        // bo trong chinh onClick nay (xem chu thich tai useDownloadFile()) - goi
                        // close() sau do khong lam mat tinh dong bo vi close() chi setState, khong
                        // await gi ca.
                        onClick={() => {
                          download.openFile(file.id, 'inline');
                          close();
                        }}
                      >
                        <EyeIcon className="h-4 w-4" /> {t('documents:fileTable.viewFile')}
                      </DropdownItem>
                      <DropdownItem
                        // 22/07/2026: tuong tu nut "Xem tệp" - dung openFile() de tab tai xuong
                        // duoc mo dong bo trong gesture, tranh bi popup blocker chan am tham.
                        onClick={() => {
                          download.openFile(file.id, 'attachment');
                          close();
                        }}
                      >
                        <DownloadIcon className="h-4 w-4" /> {t('documents:fileTable.download')}
                      </DropdownItem>
                      <DropdownItem
                        onClick={() => {
                          onShare(file);
                          close();
                        }}
                      >
                        <ShareIcon className="h-4 w-4" /> {t('documents:fileTable.share')}
                      </DropdownItem>
                      <DropdownItem
                        onClick={() => {
                          onVersionHistory(file);
                          close();
                        }}
                      >
                        <ClockIcon className="h-4 w-4" /> {t('documents:fileTable.versionHistory')}
                      </DropdownItem>
                      <DropdownItem
                        className="text-rose-600 hover:bg-rose-50"
                        onClick={() => {
                          setDeleting(file);
                          close();
                        }}
                      >
                        <TrashIcon className="h-4 w-4" /> {t('documents:fileTable.delete')}
                      </DropdownItem>
                    </div>
                  )}
                </Dropdown>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteFile.mutate(deleting.id);
          setDeleting(null);
        }}
        title={t('documents:fileTable.deleteConfirm.title')}
        description={deleting ? t('documents:fileTable.deleteConfirm.description', { name: deleting.name }) : undefined}
        confirmLabel={t('documents:fileTable.deleteConfirm.confirmLabel')}
        danger
      />
    </>
  );
}
