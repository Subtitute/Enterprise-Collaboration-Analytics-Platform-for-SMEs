import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '@app/common-dto';
import { AllExceptionsFilter } from './http-exception.filter';

/**
 * 25/08/2026: unit test cho fix code review Minor (phat hien qua dot ra soat toan du an lan 3) -
 * loi KHONG PHAI HttpException (vd 1 loi that su khong luong truoc, TypeORM EntityNotFoundError...)
 * truoc day khong duoc gan `errorCode`, khien nguoi dung EN/JA van thay message fallback tieng
 * Viet thay vi ban dich `ERROR_CODES.INTERNAL_ERROR` da co san trong en/errors.json + ja/errors.json.
 */
function createHost(): { host: ArgumentsHost; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ headers: {}, url: '/test' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, json, status };
}

describe('AllExceptionsFilter', () => {
  it('gan errorCode = INTERNAL_ERROR cho loi KHONG PHAI HttpException (vd loi ha tang khong luong truoc)', () => {
    const filter = new AllExceptionsFilter();
    const { host, json, status } = createHost();

    filter.catch(new Error('Loi ha tang khong luong truoc'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: ERROR_CODES.INTERNAL_ERROR }));
  });

  it('KHONG ghi de errorCode neu HttpException than la object da tu gan san (hanh vi cu, khong doi)', () => {
    const filter = new AllExceptionsFilter();
    const { host, json } = createHost();

    filter.catch(
      new BadRequestException({ message: 'Khong tim thay du an', errorCode: ERROR_CODES.PROJECT_NOT_FOUND }),
      host,
    );

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: ERROR_CODES.PROJECT_NOT_FOUND }));
  });

  it('HttpException than la chuoi don gian (chua tung gan errorCode) van giu nguyen hanh vi cu - khong co errorCode', () => {
    const filter = new AllExceptionsFilter();
    const { host, json } = createHost();

    filter.catch(new BadRequestException('Loi validate don gian'), host);

    const payload = json.mock.calls[0][0];
    expect(payload.errorCode).toBeUndefined();
    expect(payload.message).toBe('Loi validate don gian');
  });
});
