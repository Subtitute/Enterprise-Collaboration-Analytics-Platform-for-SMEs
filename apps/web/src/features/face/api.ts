import { apiClient } from '@/lib/api-client';
import type { FaceEnrollmentStatus, FaceInspectResult } from '@/types';

/**
 * 26/10/2026: kho anh nhan dien + dong y (ml-service, Technical_Spec.md muc 27.6) - thay 3 ham
 * dang ky/xoa cu o features/hrm/api.ts (verify khi cham cong van o do). Anh nhan dien CHI tai qua
 * proxy (axios -> blob, server tra `Cache-Control: no-store` + ghi nhat ky moi lan xem), KHONG co URL
 * cong khai/presigned.
 */
export const FACE_CONSENT_VERSION = 'face-consent-v1';

function photoForm(photo: Blob): FormData {
  const form = new FormData();
  form.append('photo', photo, 'face.jpg');
  return form;
}

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

// ---------------------------------------------------------------- chinh chu ----

export async function getMyFaceStatus(): Promise<FaceEnrollmentStatus> {
  const { data } = await apiClient.get<FaceEnrollmentStatus>('/ml/face/enrollment');
  return data;
}

export async function enrollMyFace(photo: Blob, source: 'SELF_CAMERA' | 'SELF_UPLOAD'): Promise<FaceEnrollmentStatus> {
  const form = photoForm(photo);
  form.append('consentTextVersion', FACE_CONSENT_VERSION);
  form.append('source', source);
  const { data } = await apiClient.post<FaceEnrollmentStatus>('/ml/face/enroll', form, MULTIPART);
  return data;
}

export async function confirmMyPendingFace(): Promise<FaceEnrollmentStatus> {
  const { data } = await apiClient.post<FaceEnrollmentStatus>('/ml/face/enrollment/confirm', { consentTextVersion: FACE_CONSENT_VERSION });
  return data;
}

export async function rejectMyPendingFace(): Promise<FaceEnrollmentStatus> {
  const { data } = await apiClient.post<FaceEnrollmentStatus>('/ml/face/enrollment/reject');
  return data;
}

export async function withdrawMyFace(): Promise<void> {
  await apiClient.delete('/ml/face/enrollment');
}

export async function fetchMyFacePhoto(pending: boolean): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(pending ? '/ml/face/enrollment/pending/photo' : '/ml/face/enrollment/photo', {
    responseType: 'blob',
  });
  return data;
}

// ---------------------------------------------------------------- Org Admin / Manager ----

export async function fetchFaceStatuses(userIds: string[]): Promise<FaceEnrollmentStatus[]> {
  if (userIds.length === 0) return [];
  const { data } = await apiClient.get<{ data: FaceEnrollmentStatus[] }>('/ml/face/enrollments', { params: { userIds: userIds.join(',') } });
  return data.data;
}

export async function fetchUserFaceStatus(userId: string): Promise<FaceEnrollmentStatus> {
  const { data } = await apiClient.get<FaceEnrollmentStatus>(`/ml/face/enrollments/${userId}`);
  return data;
}

export async function fetchUserFacePhoto(userId: string, pending: boolean): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/ml/face/enrollments/${userId}/photo`, { params: { pending }, responseType: 'blob' });
  return data;
}

export async function uploadUserFace(userId: string, photo: Blob, source: 'ADMIN' | 'IMPORT'): Promise<FaceEnrollmentStatus> {
  const { data } = await apiClient.put<FaceEnrollmentStatus>(`/ml/face/enrollments/${userId}`, photoForm(photo), {
    ...MULTIPART,
    params: { source },
  });
  return data;
}

export async function deleteUserFace(userId: string): Promise<void> {
  await apiClient.delete(`/ml/face/enrollments/${userId}`);
}

/** Chi huy ban CHO (giu ban dang dung) - nut "Huy anh cho" (Wireframe muc 16.3 b). */
export async function deleteUserPendingFace(userId: string): Promise<void> {
  await apiClient.delete(`/ml/face/enrollments/${userId}`, { params: { pending: true } });
}

export async function inspectFacePhoto(photo: Blob, userId?: string): Promise<FaceInspectResult> {
  const { data } = await apiClient.post<FaceInspectResult>('/ml/face/inspect', photoForm(photo), {
    ...MULTIPART,
    params: userId ? { userId } : undefined,
  });
  return data;
}
