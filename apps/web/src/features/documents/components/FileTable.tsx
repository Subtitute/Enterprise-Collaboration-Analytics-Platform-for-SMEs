import { useState } from 'react';
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
  const [deleting, setDeleting] = useState<FileItem | null>(null);
  const download = useDownloadFile();
  const deleteFile = useDeleteFile(folderId);

  return (
    <>
      <Table>
        <TableHead>
          <tr>
            <TableHeadCell>Tên tệp</TableHeadCell>
            <TableHeadCell>Kích thước</TableHeadCell>
            <TableHeadCell>Phiên bản</TableHeadCell>
            <TableHeadCell>Cập nhật</TableHeadCell>
            <TableHeadCell className="text-right">Hành động</TableHeadCell>
          </tr>
        </TableHead>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.id}>
              <TableCell label="Tên tệp">
                <button
                  type="button"
                  // 22/07/2026: goi download.openFile() (khong phai .mutate() truc tiep) - ham nay
                  // tu mo tab trong DONG BO ngay trong onClick truoc khi goi API, xem giai thich
                  // day du tai dinh nghia useDownloadFile() o documents/hooks.ts.
                  onClick={() => download.openFile(file.id, 'inline')}
                  title="Mở và xem tệp trong tab mới"
                  className="flex min-w-0 items-center gap-2.5 text-left hover:underline"
                >
                  <FileIcon className="h-4 w-4 shrink-0 text-primary-500" />
                  <span className="truncate font-medium text-slate-800">{file.name}</span>
                </button>
              </TableCell>
              <TableCell label="Kích thước" className="whitespace-nowrap text-xs text-slate-500">
                {formatBytes(file.size)}
              </TableCell>
              <TableCell label="Phiên bản">
                <Badge variant="outline">v{file.version ?? 1}</Badge>
              </TableCell>
              <TableCell label="Cập nhật" className="whitespace-nowrap text-xs text-slate-500">
                {formatDateTime(file.updatedAt)}
              </TableCell>
              <TableCell label="Hành động" className="text-right">
                <Dropdown
                  align="right"
                  trigger={({ toggle }) => (
                    <button onClick={toggle} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Tùy chọn tệp">
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
                        <EyeIcon className="h-4 w-4" /> Xem tệp
                      </DropdownItem>
                      <DropdownItem
                        // 22/07/2026: tuong tu nut "Xem tệp" - dung openFile() de tab tai xuong
                        // duoc mo dong bo trong gesture, tranh bi popup blocker chan am tham.
                        onClick={() => {
                          download.openFile(file.id, 'attachment');
                          close();
                        }}
                      >
                        <DownloadIcon className="h-4 w-4" /> Tải xuống
                      </DropdownItem>
                      <DropdownItem
                        onClick={() => {
                          onShare(file);
                          close();
                        }}
                      >
                        <ShareIcon className="h-4 w-4" /> Chia sẻ
                      </DropdownItem>
                      <DropdownItem
                        onClick={() => {
                          onVersionHistory(file);
                          close();
                        }}
                      >
                        <ClockIcon className="h-4 w-4" /> Lịch sử phiên bản
                      </DropdownItem>
                      <DropdownItem
                        className="text-rose-600 hover:bg-rose-50"
                        onClick={() => {
                          setDeleting(file);
                          close();
                        }}
                      >
                        <TrashIcon className="h-4 w-4" /> Xoá tệp
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
        title="Xoá tệp này?"
        description={deleting ? `"${deleting.name}" sẽ bị xoá khỏi hệ thống.` : undefined}
        confirmLabel="Xoá tệp"
        danger
      />
    </>
  );
}
