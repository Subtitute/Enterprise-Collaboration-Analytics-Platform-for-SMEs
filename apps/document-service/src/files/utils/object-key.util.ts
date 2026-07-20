/**
 * Quy uoc dat ten object key MinIO cho 1 phien ban file cu the.
 * `${organizationId}/${fileId}/v${versionNumber}/${originalFileName}`
 */
export function buildObjectKey(
  organizationId: string,
  fileId: string,
  versionNumber: number,
  originalFileName: string,
): string {
  return `${organizationId}/${fileId}/v${versionNumber}/${originalFileName}`;
}
