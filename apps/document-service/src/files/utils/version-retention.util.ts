/** Chinh sach versioning - Technical_Spec.md muc 3.4: giu toi da N ban gan nhat moi file. */
export const MAX_FILE_VERSIONS = 5;

export interface VersionLike {
  versionNumber: number;
}

/**
 * Nhan vao TOAN BO cac phien ban hien co cua 1 file (bao gom ban vua duoc them), tra ve
 * danh sach cac ban CU NHAT can xoa (ca ban ghi DB lan object MinIO tuong ung) de tong so
 * ban con lai khong vuot qua `maxVersions`.
 *
 * Ham thuan (pure function), khong phu thuoc DB/MinIO - de unit test doc lap
 * (Technical_Spec.md muc 10: "Unit test: Logic nghiep vu cot loi moi service").
 */
export function pruneOldVersions<T extends VersionLike>(
  allVersions: T[],
  maxVersions: number = MAX_FILE_VERSIONS,
): T[] {
  if (allVersions.length <= maxVersions) return [];
  const sortedOldestFirst = [...allVersions].sort((a, b) => a.versionNumber - b.versionNumber);
  const excessCount = sortedOldestFirst.length - maxVersions;
  return sortedOldestFirst.slice(0, excessCount);
}
