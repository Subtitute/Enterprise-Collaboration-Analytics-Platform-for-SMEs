import { isAllowedPhotoMimeType, isBufferContentConsistentWithMimeType } from './allowed-photo-mime-types';

describe('isAllowedPhotoMimeType', () => {
  it('chap nhan image/jpeg va image/png', () => {
    expect(isAllowedPhotoMimeType('image/jpeg')).toBe(true);
    expect(isAllowedPhotoMimeType('image/png')).toBe(true);
  });

  it('tu choi cac mime type khac (vd anh cham cong khong duoc phep la application/pdf)', () => {
    expect(isAllowedPhotoMimeType('application/pdf')).toBe(false);
    expect(isAllowedPhotoMimeType('image/gif')).toBe(false);
  });
});

describe('isBufferContentConsistentWithMimeType', () => {
  it('khop dung khi buffer bat dau bang chu ky PNG that su', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(isBufferContentConsistentWithMimeType(buffer, 'image/png')).toBe(true);
  });

  it('khop dung khi buffer bat dau bang chu ky JPEG that su', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(isBufferContentConsistentWithMimeType(buffer, 'image/jpeg')).toBe(true);
  });

  it('tu choi khi noi dung THAT SU khong khop voi mimeType client khai bao (gia mao Content-Type)', () => {
    // Khai bao la PNG nhung noi dung that su la chu ky JPEG.
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(isBufferContentConsistentWithMimeType(buffer, 'image/png')).toBe(false);
  });
});
