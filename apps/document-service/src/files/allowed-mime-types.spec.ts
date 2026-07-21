import { BadRequestException } from '@nestjs/common';
import { ALLOWED_MIME_TYPES, isAllowedMimeType, mimeTypeFileFilter } from './allowed-mime-types';

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
