import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { vietnameseValidationExceptionFactory } from './vietnamese-validation.pipe';

// 25/07/2026: unit test cho vietnameseValidationExceptionFactory - bo sung cung luc voi file
// implementation de fix audit "loi 400 cua ValidationPipe tra tieng Anh cho client" (xem chi
// tiet trong vietnamese-validation.pipe.ts). Bao phu: tung constraint-key thuc te dang dung
// trong DTO cua du an, hanh vi trich xuat so cho minLength/maxLength/min/max, fallback cho
// constraint khong duoc anh xa, va flatten loi long nhau/mang phan tu DTO (error.children).

/** Helper dung chung: tao 1 ValidationError toi gian (dung shape class-validator tra ve). */
function makeError(
  property: string,
  constraints?: Record<string, string>,
  children?: ValidationError[],
): ValidationError {
  return {
    target: {},
    property,
    value: undefined,
    constraints,
    children: children ?? [],
  } as ValidationError;
}

/** Helper: goi factory va lay ra mang message tieng Viet tu response body cua BadRequestException. */
function runFactory(errors: ValidationError[]): { statusCode: number; error: string; message: string[] } {
  const exception = vietnameseValidationExceptionFactory(errors);
  expect(exception).toBeInstanceOf(BadRequestException);
  const body = exception.getResponse() as { error: string; message: string[] };
  return { statusCode: exception.getStatus(), error: body.error, message: body.message };
}

describe('vietnameseValidationExceptionFactory', () => {
  it('tra ve BadRequestException voi status 400 va error = VALIDATION_ERROR', () => {
    const { statusCode, error } = runFactory([makeError('email', { isEmail: 'email must be an email' })]);
    expect(statusCode).toBe(400);
    expect(error).toBe('VALIDATION_ERROR');
  });

  // 25/07/2026: bao phu toan bo constraint-key thuc te ra soat duoc qua grep DTO toan du an
  // (xem bang anh xa CONSTRAINT_MESSAGE_BUILDERS trong file implementation).
  describe('anh xa tung constraint-key sang tieng Viet (khong con tieng Anh)', () => {
    const cases: Array<[string, string, string]> = [
      ['isEmail', 'email must be an email', 'email'],
      ['isString', 'name must be a string', 'name'],
      ['isNotEmpty', 'name should not be empty', 'name'],
      ['isUuid', 'departmentId must be a UUID', 'departmentId'],
      ['isArray', 'roleIds must be an array', 'roleIds'],
      ['isInt', 'page must be an integer number', 'page'],
      ['isNumber', 'amount must be a number conforming to the specified constraints', 'amount'],
      ['isBoolean', 'isRead must be a boolean value', 'isRead'],
      ['isEnum', 'status must be a valid enum value', 'status'],
      ['isIn', 'range must be one of the following values: 7d, 30d, quarter', 'range'],
      ['isDateString', 'dueDate must be a valid ISO 8601 date string', 'dueDate'],
      ['arrayNotEmpty', 'permissionKeys should not be empty', 'permissionKeys'],
    ];

    it.each(cases)('constraint "%s" -> message tieng Viet, khong con chuoi tieng Anh goc', (key, original, property) => {
      const { message } = runFactory([makeError(property, { [key]: original })]);
      expect(message).toHaveLength(1);
      expect(message[0]).toContain(property);
      expect(message[0]).not.toEqual(original);
      expect(message[0].toLowerCase()).not.toMatch(/must|should|invalid|valid enum/);
    });
  });

  describe('trich xuat con so tu message mac dinh cho constraint co gioi han', () => {
    it('minLength: giu dung con so gioi han duoi trong cau tieng Viet', () => {
      const { message } = runFactory([
        makeError('initialPassword', {
          minLength: 'initialPassword must be longer than or equal to 8 characters',
        }),
      ]);
      expect(message[0]).toBe('initialPassword: phai co it nhat 8 ky tu');
    });

    it('maxLength: giu dung con so gioi han tren trong cau tieng Viet', () => {
      const { message } = runFactory([
        makeError('title', { maxLength: 'title must be shorter than or equal to 255 characters' }),
      ]);
      expect(message[0]).toBe('title: khong duoc vuot qua 255 ky tu');
    });

    it('min: giu dung con so trong cau tieng Viet (vd @Min(1) cua PaginationQueryDto)', () => {
      const { message } = runFactory([makeError('page', { min: 'page must not be less than 1' })]);
      expect(message[0]).toBe('page: phai lon hon hoac bang 1');
    });

    it('max: giu dung con so trong cau tieng Viet (vd @Max(100000) cua PaginationQueryDto)', () => {
      const { message } = runFactory([
        makeError('page', { max: 'page must not be greater than 100000' }),
      ]);
      expect(message[0]).toBe('page: phai nho hon hoac bang 100000');
    });

    it('arrayMinSize/arrayMaxSize: giu dung con so trong cau tieng Viet', () => {
      const { message } = runFactory([
        makeError('roleIds', { arrayMinSize: 'roleIds must contain at least 1 elements' }),
        makeError('roleIds', { arrayMaxSize: 'roleIds must contain not more than 10 elements' }),
      ]);
      expect(message[0]).toBe('roleIds: phai co it nhat 1 phan tu');
      expect(message[1]).toBe('roleIds: khong duoc vuot qua 10 phan tu');
    });

    it('khong tim thay con so trong message mac dinh van tra ve cau hop le (khong crash)', () => {
      const { message } = runFactory([makeError('page', { min: 'page khong hop le' })]);
      expect(message[0]).toBe('page: gia tri qua nho');
    });
  });

  describe('fallback cho constraint-key khong nam trong bang anh xa', () => {
    it('van tra ve tieng Viet, co ten field, khong lo tieng Anh cua constraint la', () => {
      const { message } = runFactory([
        makeError('customField', { someFutureConstraint: 'customField failed on some future rule' }),
      ]);
      expect(message[0]).toBe('customField: gia tri khong hop le');
    });
  });

  describe('flatten loi long nhau (nested DTO / mang phan tu DTO)', () => {
    it('gop loi tu error.children thanh duong dan field dang "parent.child"', () => {
      const nested = makeError('address', undefined, [
        makeError('city', { isNotEmpty: 'city should not be empty' }),
      ]);
      const { message } = runFactory([nested]);
      expect(message).toHaveLength(1);
      expect(message[0]).toBe('address.city: khong duoc de trong');
    });

    it('gop loi long nhau nhieu cap va nhieu phan tu mang (vd items.0.name, items.1.qty)', () => {
      const itemsError = makeError('items', undefined, [
        makeError('0', undefined, [makeError('name', { isString: 'name must be a string' })]),
        makeError('1', undefined, [makeError('qty', { isInt: 'qty must be an integer number' })]),
      ]);
      const { message } = runFactory([itemsError]);
      expect(message).toEqual(
        expect.arrayContaining(['items.0.name: phai la chuoi ky tu', 'items.1.qty: phai la so nguyen']),
      );
      expect(message).toHaveLength(2);
    });

    it('gop ca loi cap cao nhat lan loi trong children khi ca hai cung ton tai', () => {
      const error = makeError('profile', { isNotEmpty: 'profile should not be empty' }, [
        makeError('email', { isEmail: 'email must be an email' }),
      ]);
      const { message } = runFactory([error]);
      expect(message).toEqual(
        expect.arrayContaining(['profile: khong duoc de trong', 'profile.email: dinh dang email khong hop le']),
      );
      expect(message).toHaveLength(2);
    });
  });

  describe('nhieu loi tren nhieu field cung luc', () => {
    it('tra ve mang message, moi phan tu ung voi 1 constraint bi vi pham', () => {
      const { message } = runFactory([
        makeError('email', { isEmail: 'email must be an email' }),
        makeError('password', { minLength: 'password must be longer than or equal to 8 characters' }),
      ]);
      expect(message).toEqual([
        'email: dinh dang email khong hop le',
        'password: phai co it nhat 8 ky tu',
      ]);
    });
  });

  describe('truong hop bien: khong co loi nao / errors rong', () => {
    it('errors la mang rong van tra ve BadRequestException voi message mac dinh hop le', () => {
      const { message } = runFactory([]);
      expect(message).toEqual(['Du lieu gui len khong hop le']);
    });
  });
});
