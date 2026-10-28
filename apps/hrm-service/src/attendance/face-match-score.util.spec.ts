import { createHash, createHmac } from 'crypto';
import { verifyFaceMatchToken } from './face-match-score.util';

// 28/10/2026: token ky diem khuon mat - thay cho test parseOptionalFaceMatchScore (diem tho tu trinh
// duyet khong con duoc nhan).
const SECRET = 'dev-shared-secret-change-me';
const NOW = 1_700_000_000;
const PHOTO = Buffer.from('photo');
const CTX = { organizationId: 'org-1', userId: 'user-1', photo: PHOTO };

// Vector sinh boi apps/ml-service/app/face_token.py (tests/test_face_token.py::FIXED_VECTOR) - khop
// tung byte giua Python va TypeScript.
const FIXED_VECTOR =
  'eyJ2IjoxLCJvcmciOiJvcmctMSIsInN1YiI6InVzZXItMSIsInNjb3JlIjowLjUsInBoIjoiNTVjNjRkMGZjZDZmOWQ1ZjdjODI4' +
  'MDkzODU3ZTNmZGZkYTY4NDc4YmI0ZTliZDI0ZDQ4MWVmMzkxYzc4MDRlOCIsImV4cCI6MTcwMDAwMDMwMH0' +
  '.KK-t7o90hciOCF9d6vXAEOgDp8YXIvjLqxdprhTRz-A';

function sign(payload: Record<string, unknown>, secret = SECRET): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const key = createHmac('sha256', secret).update('ecap-face-match-score-v1').digest();
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    v: 1,
    org: 'org-1',
    sub: 'user-1',
    score: 0.62,
    ph: createHash('sha256').update(PHOTO).digest('hex'),
    exp: NOW + 300,
    ...overrides,
  };
}

describe('verifyFaceMatchToken', () => {
  it('nhan dung vector do ml-service ky (khop dinh dang giua 2 ngon ngu)', () => {
    expect(verifyFaceMatchToken(FIXED_VECTOR, CTX, SECRET, NOW)).toEqual({ score: 0.5 });
  });

  it('khong gui token (chua dang ky khuon mat/khong thay mat) -> khong co diem, khong bao loi', () => {
    expect(verifyFaceMatchToken(undefined, CTX, SECRET, NOW)).toEqual({});
    expect(verifyFaceMatchToken('   ', CTX, SECRET, NOW)).toEqual({});
  });

  it('token hop le -> tra ve diem', () => {
    expect(verifyFaceMatchToken(sign(payload()), CTX, SECRET, NOW)).toEqual({ score: 0.62 });
  });

  it('sua diem trong payload (gia mao 0.99) -> sai chu ky, bo qua diem', () => {
    const [, signature] = sign(payload()).split('.');
    const forgedBody = Buffer.from(JSON.stringify(payload({ score: 0.99 }))).toString('base64url');
    expect(verifyFaceMatchToken(`${forgedBody}.${signature}`, CTX, SECRET, NOW)).toEqual({ rejected: 'bad-signature' });
  });

  it('ky bang secret khac -> bo qua', () => {
    expect(verifyFaceMatchToken(sign(payload(), 'secret-khac'), CTX, SECRET, NOW)).toEqual({ rejected: 'bad-signature' });
  });

  it('token cua nguoi khac hoac to chuc khac -> bo qua', () => {
    expect(verifyFaceMatchToken(sign(payload({ sub: 'user-2' })), CTX, SECRET, NOW)).toEqual({ rejected: 'other-user' });
    expect(verifyFaceMatchToken(sign(payload({ org: 'org-2' })), CTX, SECRET, NOW)).toEqual({ rejected: 'other-user' });
  });

  it('dung token cua anh khac cho anh cham cong nay -> bo qua', () => {
    const ctx = { ...CTX, photo: Buffer.from('anh-khac') };
    expect(verifyFaceMatchToken(sign(payload()), ctx, SECRET, NOW)).toEqual({ rejected: 'other-photo' });
  });

  it('token het han -> bo qua', () => {
    expect(verifyFaceMatchToken(sign(payload({ exp: NOW - 1 })), CTX, SECRET, NOW)).toEqual({ rejected: 'expired' });
  });

  it('token hong dinh dang -> bo qua', () => {
    expect(verifyFaceMatchToken('khong-co-dau-cham', CTX, SECRET, NOW)).toEqual({ rejected: 'malformed' });
    expect(verifyFaceMatchToken('a.b.c', CTX, SECRET, NOW)).toEqual({ rejected: 'malformed' });
  });

  it('kep diem lech nho do sai so float32, bo qua diem vo ly', () => {
    expect(verifyFaceMatchToken(sign(payload({ score: 1.0000001192092896 })), CTX, SECRET, NOW)).toEqual({ score: 1 });
    expect(verifyFaceMatchToken(sign(payload({ score: 50 })), CTX, SECRET, NOW)).toEqual({ rejected: 'score-out-of-range' });
  });
});
