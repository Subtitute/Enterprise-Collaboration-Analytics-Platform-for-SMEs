/**
 * 26/10/2026: chuan hoa anh PHIA TRINH DUYET truoc khi gui (Technical_Spec.md muc 27.5/27.9) -
 * createImageBitmap(imageOrientation: 'from-image') sua xoay theo EXIF, ve lai len canvas roi xuat
 * JPEG -> mat toan bo EXIF/GPS. Anh nhan dien: canh dai <= 1280px, JPEG 0,9; avatar: cat vuong giua
 * 512px. Server van ma hoa lai lan nua (ml-service) / kiem tra magic bytes (iam-service).
 */
export class ImageNormalizeError extends Error {}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // HEIC/tep hong: trinh duyet khong giai ma duoc -> loi theo dong (FACE_INVALID_IMAGE).
    throw new ImageNormalizeError('decode-failed');
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ImageNormalizeError('encode-failed'))), 'image/jpeg', quality);
  });
}

export async function normalizeFacePhoto(file: Blob, maxSide = 1280, quality = 0.9): Promise<Blob> {
  const bitmap = await decode(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return toJpeg(canvas, quality);
}

export async function cropSquareAvatar(file: Blob, size = 512): Promise<Blob> {
  const bitmap = await decode(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d')?.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return toJpeg(canvas, 0.9);
}
