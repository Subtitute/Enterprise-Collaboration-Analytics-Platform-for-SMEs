import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ERROR_CODES, ErrorDetail } from '@app/common-dto';

// 25/07/2026: bo sung file nay - phat hien qua audit toan du an: ca 6 main.ts (Gateway khong co
// vi la reverse-proxy thuan khong doc body, IAM/Project-Task/Document/Analytics/Notification)
// deu dung `new ValidationPipe({ whitelist: true, transform: true })` MA KHONG truyen
// `exceptionFactory`, khien class-validator/Nest tra thang message loi mac dinh bang TIENG ANH
// cho client (vd "page must not be greater than 100000",
// "adminPassword must be longer than or equal to 8 characters", "email must be an email") -
// vi pham quy tac 1 cua du an (Vietnamese-first cho moi chuoi huong nguoi dung). Ham
// `vietnameseValidationExceptionFactory` duoi day duoc gan lam `exceptionFactory` cho MOI
// ValidationPipe toan he thong de dam bao 100% loi 400 tu class-validator (moi DTO, moi service)
// tra ve tieng Viet, dong bo dinh dang voi AllExceptionsFilter (xem
// packages/common-guard/src/filters/http-exception.filter.ts) va ErrorResponseDto (dinh dang
// chuan Technical_Spec.md muc 7: `{statusCode, error: 'VALIDATION_ERROR', message, timestamp}`).

/** Dang phang (sau khi de quy flatten) cua 1 loi validate tren 1 field cu the. */
interface FlatValidationError {
  /** Duong dan field, vd 'email' hoac 'items.0.name' voi DTO long nhau/mang phan tu DTO. */
  property: string;
  /** constraints goc do class-validator sinh ra: key la ten constraint (vd 'isEmail'), value la message mac dinh (thuong la tieng Anh). */
  constraints: Record<string, string>;
}

// 25/07/2026: class-validator tra ValidationError[] dang CAY (loi cua DTO long nhau/mang phan tu
// la DTO nam trong `error.children`, KHONG nam o cap cao nhat) - de quy flatten ve danh sach
// phang {property, constraints} de duyet don gian ben duoi. Ghep duong dan bang dau '.' (vd DTO
// co field `items: ItemDto[]` loi o phan tu thu 2, field `name` -> property tra ve 'items.1.name').
function flattenValidationErrors(errors: ValidationError[], parentPath = ''): FlatValidationError[] {
  const result: FlatValidationError[] = [];
  for (const error of errors) {
    const propertyPath = parentPath ? `${parentPath}.${error.property}` : error.property;
    if (error.constraints && Object.keys(error.constraints).length > 0) {
      result.push({ property: propertyPath, constraints: error.constraints });
    }
    if (error.children && error.children.length > 0) {
      result.push(...flattenValidationErrors(error.children, propertyPath));
    }
  }
  return result;
}

// 25/07/2026: nhieu constraint (minLength/maxLength/min/max/arrayMinSize/arrayMaxSize) can nhac
// lai CHINH XAC con so gioi han trong message tieng Viet (vd "toi thieu 8 ky tu") de nguoi dung
// biet sua the nao, nhung factory nay KHONG co quyen truy cap truc tiep vao options goc cua
// decorator (@MinLength(8) chi con lai trong `constraints[key]` duoi dang message mac dinh cua
// class-validator, vd "initialPassword must be longer than or equal to 8 characters"). Giai phap
// thuc dung (theo dung pham vi yeu cau, khong over-engineer parser cho tung dang message): lay
// so dau tien xuat hien trong message mac dinh bang regex don gian. Voi toan bo ten field dang
// dung trong du an (khong chua chu so), day la cach trich xuat dung va du dung.
function extractFirstNumber(defaultMessage: string | undefined): string | undefined {
  if (!defaultMessage) return undefined;
  const match = defaultMessage.match(/-?\d+(\.\d+)?/);
  return match ? match[0] : undefined;
}

type MessageBuilder = (property: string, defaultMessage: string) => string;

// 25/07/2026: bang anh xa constraint-key (ten do class-validator sinh ra trong
// ValidationError.constraints, vd 'isEmail', 'minLength'...) sang cau tieng Viet tu nhien, bao
// gom TOAN BO constraint key thuc te dang duoc dung trong cac DTO cua du an (ra soat bang grep
// toan bo `apps/*/src/**/dto/*.ts` va `packages/common-dto/src/dto/*.ts` - 25/07/2026): IsEmail,
// IsString, IsNotEmpty, IsUUID, IsArray, IsInt, Min, Max, IsIn, IsEnum, IsBoolean, IsDateString,
// ArrayNotEmpty, MinLength. Bo sung them MaxLength/IsNumber/ArrayMinSize/ArrayMaxSize du hien
// chua co DTO nao dung toi, phong truong hop DTO tuong lai bo sung (fallback ben duoi van dam
// bao khong lo tieng Anh ke ca voi constraint chua liet ke o day).
const CONSTRAINT_MESSAGE_BUILDERS: Record<string, MessageBuilder> = {
  isEmail: (p) => `${p}: dinh dang email khong hop le`,
  isString: (p) => `${p}: phai la chuoi ky tu`,
  isNotEmpty: (p) => `${p}: khong duoc de trong`,
  isUuid: (p) => `${p}: phai la UUID hop le`,
  isArray: (p) => `${p}: phai la mot danh sach (array)`,
  isInt: (p) => `${p}: phai la so nguyen`,
  isNumber: (p) => `${p}: phai la so`,
  isBoolean: (p) => `${p}: phai la gia tri dung/sai (true/false)`,
  isEnum: (p) => `${p}: gia tri khong nam trong danh sach cho phep`,
  isIn: (p) => `${p}: gia tri khong nam trong danh sach cho phep`,
  isDateString: (p) => `${p}: phai la ngay hop le (dinh dang ISO-8601)`,
  arrayNotEmpty: (p) => `${p}: danh sach khong duoc de trong`,
  minLength: (p, m) => {
    const n = extractFirstNumber(m);
    return n ? `${p}: phai co it nhat ${n} ky tu` : `${p}: qua ngan`;
  },
  maxLength: (p, m) => {
    const n = extractFirstNumber(m);
    return n ? `${p}: khong duoc vuot qua ${n} ky tu` : `${p}: qua dai`;
  },
  min: (p, m) => {
    const n = extractFirstNumber(m);
    return n ? `${p}: phai lon hon hoac bang ${n}` : `${p}: gia tri qua nho`;
  },
  max: (p, m) => {
    const n = extractFirstNumber(m);
    return n ? `${p}: phai nho hon hoac bang ${n}` : `${p}: gia tri qua lon`;
  },
  arrayMinSize: (p, m) => {
    const n = extractFirstNumber(m);
    return n ? `${p}: phai co it nhat ${n} phan tu` : `${p}: co qua it phan tu`;
  },
  arrayMaxSize: (p, m) => {
    const n = extractFirstNumber(m);
    return n ? `${p}: khong duoc vuot qua ${n} phan tu` : `${p}: co qua nhieu phan tu`;
  },
};

// 25/07/2026: fallback bat buoc cho MOI constraint-key khong ton tai trong bang anh xa o tren -
// dam bao "khong bao gio de lot tieng Anh ra ngoai" du la loi khong luong truoc duoc (vd DTO
// tuong lai dung mot decorator chua duoc liet ke tai day). Van neu ro ten field de nguoi dung
// con biet cho nao sai.
function buildMessageForConstraint(property: string, constraintKey: string, defaultMessage: string): string {
  const builder = CONSTRAINT_MESSAGE_BUILDERS[constraintKey];
  if (builder) return builder(property, defaultMessage);
  return `${property}: gia tri khong hop le`;
}

// 20/08/2026: anh xa constraint-key -> ma loi may doc duoc, khop 1:1 voi CONSTRAINT_MESSAGE_BUILDERS
// o tren (xem packages/common-dto/src/constants/error-codes.constant.ts). Constraint-key khong co
// trong bang nay roi ve ERROR_CODES.VALIDATION_INVALID (cung fallback voi buildMessageForConstraint).
const CONSTRAINT_ERROR_CODES: Record<string, string> = {
  isEmail: ERROR_CODES.VALIDATION_INVALID_EMAIL,
  isString: ERROR_CODES.VALIDATION_INVALID_STRING,
  isNotEmpty: ERROR_CODES.VALIDATION_REQUIRED,
  isUuid: ERROR_CODES.VALIDATION_INVALID_UUID,
  isArray: ERROR_CODES.VALIDATION_INVALID_ARRAY,
  isInt: ERROR_CODES.VALIDATION_INVALID_INT,
  isNumber: ERROR_CODES.VALIDATION_INVALID_NUMBER,
  isBoolean: ERROR_CODES.VALIDATION_INVALID_BOOLEAN,
  isEnum: ERROR_CODES.VALIDATION_INVALID_ENUM,
  isIn: ERROR_CODES.VALIDATION_INVALID_OPTION,
  isDateString: ERROR_CODES.VALIDATION_INVALID_DATE,
  arrayNotEmpty: ERROR_CODES.VALIDATION_ARRAY_REQUIRED,
  minLength: ERROR_CODES.VALIDATION_MIN_LENGTH,
  maxLength: ERROR_CODES.VALIDATION_MAX_LENGTH,
  min: ERROR_CODES.VALIDATION_MIN_VALUE,
  max: ERROR_CODES.VALIDATION_MAX_VALUE,
  arrayMinSize: ERROR_CODES.VALIDATION_ARRAY_MIN_SIZE,
  arrayMaxSize: ERROR_CODES.VALIDATION_ARRAY_MAX_SIZE,
};

/** 6 constraint co so gioi han - can them `params.n` de i18next noi lai duoc con so trong ban dich. */
const NUMERIC_CONSTRAINTS = new Set(['minLength', 'maxLength', 'min', 'max', 'arrayMinSize', 'arrayMaxSize']);

function buildErrorDetail(property: string, constraintKey: string, defaultMessage: string): ErrorDetail {
  const code = CONSTRAINT_ERROR_CODES[constraintKey] ?? ERROR_CODES.VALIDATION_INVALID;
  const params: Record<string, string | number> = { field: property };
  if (NUMERIC_CONSTRAINTS.has(constraintKey)) {
    const n = extractFirstNumber(defaultMessage);
    if (n !== undefined) params.n = n;
  }
  return { code, params };
}

/**
 * exceptionFactory dung chung cho `ValidationPipe` cua TOAN BO service (Gateway khong ap dung -
 * la reverse-proxy thuan, khong doc/validate body). Thay the message mac dinh tieng Anh cua
 * class-validator bang tieng Viet, giu nguyen dinh dang loi chuan cua du an (BadRequestException
 * voi body `{error: 'VALIDATION_ERROR', message: string[]}` - dong bo voi cach dung hien co, xem
 * apps/document-service/src/files/allowed-mime-types.ts) de AllExceptionsFilter format nhat quan
 * voi moi loi khac cua he thong (packages/common-guard/src/filters/http-exception.filter.ts).
 *
 * `message` tra ve dang MANG (moi phan tu la 1 loi tren 1 field/constraint) - giu dung quy uoc
 * mac dinh cua NestJS ValidationPipe (von da tra `message` la string[] khi co nhieu loi), chi
 * thay tung phan tu bang cau tieng Viet thay vi tieng Anh.
 *
 * 25/07/2026: bo sung de xu ly audit "loi 400 tra tieng Anh cho client" - xem giai thich chi tiet
 * o dau file.
 */
export function vietnameseValidationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const flatErrors = flattenValidationErrors(errors);

  const messages: string[] = [];
  const details: ErrorDetail[] = [];
  for (const flatError of flatErrors) {
    for (const [constraintKey, defaultMessage] of Object.entries(flatError.constraints)) {
      messages.push(buildMessageForConstraint(flatError.property, constraintKey, defaultMessage));
      details.push(buildErrorDetail(flatError.property, constraintKey, defaultMessage));
    }
  }

  // 25/07/2026: truong hop hiem (vd custom validator khong sinh `constraints`) van phai tra ve
  // mot message tieng Viet ro rang, khong duoc de mang rong khien client khong biet loi gi.
  const finalMessages = messages.length > 0 ? messages : ['Du lieu gui len khong hop le'];
  // 20/08/2026: `details` chi dinh kem khi co it nhat 1 phan tu, giu dung do dai voi finalMessages
  // (AllExceptionsFilter/extractErrorMessage ben web doi index cua 2 mang nay khop nhau).
  const finalDetails = details.length > 0 ? details : undefined;

  return new BadRequestException({
    error: 'VALIDATION_ERROR',
    message: finalMessages,
    ...(finalDetails && { details: finalDetails }),
  });
}
