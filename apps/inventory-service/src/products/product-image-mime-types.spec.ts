import { isAllowedProductImageMimeType, isBufferContentConsistentWithMimeType } from './product-image-mime-types';

describe('isAllowedProductImageMimeType', () => {
  it('chap nhan jpeg/png/webp', () => {
    expect(isAllowedProductImageMimeType('image/jpeg')).toBe(true);
    expect(isAllowedProductImageMimeType('image/png')).toBe(true);
    expect(isAllowedProductImageMimeType('image/webp')).toBe(true);
  });

  it('tu choi cac loai khac (vd gif, pdf)', () => {
    expect(isAllowedProductImageMimeType('image/gif')).toBe(false);
    expect(isAllowedProductImageMimeType('application/pdf')).toBe(false);
  });
});

describe('isBufferContentConsistentWithMimeType (magic-byte)', () => {
  it('khop PNG', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(isBufferContentConsistentWithMimeType(buffer, 'image/png')).toBe(true);
  });

  it('khop JPEG', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(isBufferContentConsistentWithMimeType(buffer, 'image/jpeg')).toBe(true);
  });

  it('khop WebP (RIFF....WEBP)', () => {
    const buffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(isBufferContentConsistentWithMimeType(buffer, 'image/webp')).toBe(true);
  });

  it('tu choi noi dung gia mao (khai bao PNG nhung noi dung thuc la JPEG)', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(isBufferContentConsistentWithMimeType(jpegBuffer, 'image/png')).toBe(false);
  });

  it('tu choi RIFF nhung khong phai WEBP (vd .wav)', () => {
    const wavBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
    expect(isBufferContentConsistentWithMimeType(wavBuffer, 'image/webp')).toBe(false);
  });
});
