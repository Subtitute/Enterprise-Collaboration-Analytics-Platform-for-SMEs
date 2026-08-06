/**
 * Quy uoc dat ten object key MinIO cho anh cham cong - mirror
 * apps/document-service/src/files/utils/object-key.util.ts.
 * `${organizationId}/${userId}/${workDate}/checkin.<ext>` hoac `checkout.<ext>`.
 */
export function buildAttendancePhotoObjectKey(
  organizationId: string,
  userId: string,
  workDate: string,
  kind: 'checkin' | 'checkout',
  mimeType: string,
): string {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  return `${organizationId}/${userId}/${workDate}/${kind}.${ext}`;
}
