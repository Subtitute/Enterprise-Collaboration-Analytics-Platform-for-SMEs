/**
 * 27/10/2026: kiem tra trinh duyet co mo duoc webcam trong trang hay khong - getUserMedia CHI co trong
 * secure context (https, localhost/127.0.0.1); dien thoai mo web qua http://192.168.x.x khong co
 * navigator.mediaDevices. Khi khong co, nut "Chup bang camera" chuyen sang
 * <input type="file" accept="image/*" capture> de mo app camera cua may (dung chung cho hop tai anh
 * ho FaceUploadDialog va the tu dang ky ProfileFaceEnrollmentCard).
 */
export function canUseWebcam(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true && typeof navigator.mediaDevices?.getUserMedia === 'function';
}
