import { BadRequestException } from '@nestjs/common';
import {
  ALLOWED_MIME_TYPES,
  isAllowedMimeType,
  isBufferContentConsistentWithMimeType,
  mimeTypeFileFilter,
  verifyFileContentMatchesMimeType,
} from './allowed-mime-types';

function file(mimetype: string): Express.Multer.File {
  return { mimetype } as Express.Multer.File;
}

describe('isAllowedMimeType (allowlist MIME - Technical_Spec.md muc 9)', () => {
  it('chap nhan tat ca cac loai trong allowlist', () => {
    for (const mimeType of ALLOWED_MIME_TYPES) {
      expect(isAllowedMimeType(mimeType)).toBe(true);
    }
  });

  it('tu choi loai MIME nguy hiem khong nam trong allowlist (vi du executable)', () => {
    expect(isAllowedMimeType('application/x-msdownload')).toBe(false);
    expect(isAllowedMimeType('application/octet-stream')).toBe(false);
    expect(isAllowedMimeType('text/html')).toBe(false);
    expect(isAllowedMimeType('application/javascript')).toBe(false);
  });

  it('phan biet hoa/thuong - khong tu y coi "PDF" viet hoa la hop le', () => {
    expect(isAllowedMimeType('APPLICATION/PDF')).toBe(false);
  });
});

describe('mimeTypeFileFilter (fileFilter cho FileInterceptor/multer)', () => {
  it('goi callback(null, true) khi mimetype hop le', () => {
    const callback = jest.fn();
    mimeTypeFileFilter({}, file('application/pdf'), callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('goi callback voi BadRequestException + accept=false khi mimetype khong hop le', () => {
    const callback = jest.fn();
    mimeTypeFileFilter({}, file('application/x-msdownload'), callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const [error, acceptFile] = callback.mock.calls[0];
    expect(acceptFile).toBe(false);
    expect(error).toBeInstanceOf(BadRequestException);

    const body = (error as BadRequestException).getResponse() as Record<string, unknown>;
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(typeof body.message).toBe('string');
    expect((error as BadRequestException).getStatus()).toBe(400);
  });
});

// 22/07/2026: bo sung - test cho kiem tra magic-byte (Fix 4, code review).
describe('isBufferContentConsistentWithMimeType (kiem tra magic-byte - Fix 4, code review 22/07/2026)', () => {
  it('chap nhan PDF hop le (chu ky "%PDF")', () => {
    const buffer = Buffer.from('%PDF-1.7\n%âãÏÓ\n');
    expect(isBufferContentConsistentWithMimeType(buffer, 'application/pdf')).toBe(true);
  });

  it('tu choi noi dung KHONG phai PDF nhung khai bao mimetype application/pdf (gia mao)', () => {
    const buffer = Buffer.from('<html><body>khong phai PDF</body></html>');
    expect(isBufferContentConsistentWithMimeType(buffer, 'application/pdf')).toBe(false);
  });

  it('chap nhan PNG hop le (chu ky \\x89PNG)', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(isBufferContentConsistentWithMimeType(buffer, 'image/png')).toBe(true);
  });

  it('tu choi file gia mao la PNG', () => {
    const buffer = Buffer.from('khong phai anh PNG');
    expect(isBufferContentConsistentWithMimeType(buffer, 'image/png')).toBe(false);
  });

  it('chap nhan JPEG hop le (chu ky FF D8 FF)', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(isBufferContentConsistentWithMimeType(buffer, 'image/jpeg')).toBe(true);
  });

  it('chap nhan GIF hop le (chu ky "GIF8")', () => {
    const buffer = Buffer.from('GIF89a...');
    expect(isBufferContentConsistentWithMimeType(buffer, 'image/gif')).toBe(true);
  });

  it('chap nhan file ZIP/OOXML (docx/xlsx/pptx/zip) voi chu ky PK\\x03\\x04', () => {
    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    expect(isBufferContentConsistentWithMimeType(buffer, 'application/zip')).toBe(true);
    expect(
      isBufferContentConsistentWithMimeType(
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe(true);
    expect(
      isBufferContentConsistentWithMimeType(
        buffer,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    ).toBe(true);
    expect(
      isBufferContentConsistentWithMimeType(
        buffer,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ),
    ).toBe(true);
  });

  it('tu choi file gia mao la docx (khong co chu ky PK)', () => {
    const buffer = Buffer.from('day khong phai file zip/docx');
    expect(
      isBufferContentConsistentWithMimeType(
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe(false);
  });

  it('chap nhan file Office nhi phan cu (.doc/.xls/.ppt) voi chu ky OLE Compound File', () => {
    const buffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
    expect(isBufferContentConsistentWithMimeType(buffer, 'application/msword')).toBe(true);
    expect(isBufferContentConsistentWithMimeType(buffer, 'application/vnd.ms-excel')).toBe(true);
    expect(isBufferContentConsistentWithMimeType(buffer, 'application/vnd.ms-powerpoint')).toBe(true);
  });

  it('tu choi file gia mao la .doc (khong co chu ky OLE)', () => {
    const buffer = Buffer.from('khong phai file OLE');
    expect(isBufferContentConsistentWithMimeType(buffer, 'application/msword')).toBe(false);
  });

  it('luon chap nhan text/csv va text/plain - gioi han da biet, van ban thuan khong co magic-byte dang tin cay', () => {
    const buffer = Buffer.from('bat ky noi dung gi, ke ca gia mao');
    expect(isBufferContentConsistentWithMimeType(buffer, 'text/csv')).toBe(true);
    expect(isBufferContentConsistentWithMimeType(buffer, 'text/plain')).toBe(true);
  });

  it('tu choi (khong crash) khi buffer ngan hon chu ky can kiem tra', () => {
    const buffer = Buffer.from([0x25, 0x50]); // chi 2/4 byte cua "%PDF"
    expect(isBufferContentConsistentWithMimeType(buffer, 'application/pdf')).toBe(false);
  });
});

describe('verifyFileContentMatchesMimeType (wrapper nem BadRequestException - Fix 4, code review 22/07/2026)', () => {
  function file(mimetype: string, buffer: Buffer): Express.Multer.File {
    return { mimetype, buffer } as Express.Multer.File;
  }

  it('khong nem loi khi noi dung khop voi mimetype khai bao', () => {
    const f = file('application/pdf', Buffer.from('%PDF-1.4'));
    expect(() => verifyFileContentMatchesMimeType(f)).not.toThrow();
  });

  it('nem BadRequestException dung dinh dang loi chuan khi noi dung KHONG khop mimetype khai bao', () => {
    expect.assertions(3);
    const f = file('application/pdf', Buffer.from('noi dung gia mao'));
    try {
      verifyFileContentMatchesMimeType(f);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const body = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(body.error).toBe('VALIDATION_ERROR');
      expect((error as BadRequestException).getStatus()).toBe(400);
    }
  });
});
