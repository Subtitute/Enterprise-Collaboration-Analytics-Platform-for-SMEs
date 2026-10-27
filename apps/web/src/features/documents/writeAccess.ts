import type { FileItem, Folder } from '@/types';

/**
 * 26/10/2026: an/hien thao tac GHI tai lieu (tai len, tao thu muc con, phien ban moi, chia se, doi ten, xoa)
 * theo CUNG quy tac backend (FolderAccessService.resolveFolderWrite): Org Admin luon duoc; thu muc goc
 * (`null`) chi Org Admin; thu muc theo co `canWrite` backend tinh san trong GET /folders (cay du an: ai xem
 * duoc thi ghi duoc; cay toan cong ty: chi Org Admin hoac nguoi duoc chia se thu muc). Chua biet thu muc
 * (`undefined`) hoac backend cu khong tra co -> hien, backend van chan. Chi de an/hien UI.
 */
export function canWriteFolder(folder: Pick<Folder, 'canWrite'> | null | undefined, isOrgAdmin: boolean): boolean {
  if (isOrgAdmin) return true;
  if (folder === null) return false;
  return folder?.canWrite !== false;
}

/**
 * 26/10/2026: thao tac GHI tren 1 tep (phien ban moi, chia se, xoa) theo quyen cua CHINH tep - backend tinh co
 * canWrite (quyen ghi thu muc HOAC FileShare EDIT truc tiep), nen tep duoc chia se EDIT trong cay toan cong ty
 * van hien nut. Backend cu khong tra co -> theo quyen thu muc dang mo.
 */
export function canWriteFile(file: Pick<FileItem, 'canWrite'> | null | undefined, folderCanWrite: boolean): boolean {
  return file?.canWrite ?? folderCanWrite;
}
