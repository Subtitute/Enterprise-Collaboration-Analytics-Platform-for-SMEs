// 24/10/2026: test moi cho extractErrorMessage() - phat hien qua kiem thu tinh nang Face
// recognition (agent QA doc lap): apps/ml-service (FastAPI/Python) tra ve loi dang
// `{ detail: string }`, KHAC han dinh dang `{ message, errorCode, ... }` cua moi service Node.
// Truoc fix nay, MOI loi tu ml-service (vd "khong phat hien duoc khuon mat") roi qua nhanh
// `error.message` cuoi cung, hien nguyen van chuoi tieng Anh cua axios thay vi ly do thuc su.
import { describe, it, expect } from 'vitest';
import { extractErrorMessage } from './api-client';

/** Gia lap toi thieu 1 AxiosError - axios.isAxiosError() chi kiem tra `isAxiosError === true`. */
function fakeAxiosError(responseData: unknown, fallbackMessage = 'Request failed with status code 400') {
  return {
    isAxiosError: true,
    message: fallbackMessage,
    response: { data: responseData },
  };
}

describe('extractErrorMessage', () => {
  it('doc dung field "detail" cua loi tu ml-service (FastAPI) khi khong co message/errorCode', () => {
    const error = fakeAxiosError({ detail: 'Khong phat hien duoc khuon mat nao trong anh' });
    expect(extractErrorMessage(error)).toBe('Khong phat hien duoc khuon mat nao trong anh');
  });

  it('uu tien "message" hon "detail" neu ca 2 cung ton tai (giu hanh vi cu cho service Node)', () => {
    const error = fakeAxiosError({ message: 'Loi nghiep vu tu service Node', detail: 'khong nen doc toi day' });
    expect(extractErrorMessage(error)).toBe('Loi nghiep vu tu service Node');
  });

  it('fallback ve error.message (chuoi axios) khi response khong co message/detail nao', () => {
    const error = fakeAxiosError({});
    expect(extractErrorMessage(error)).toBe('Request failed with status code 400');
  });

  it('khong phai AxiosError (vd loi JS thuan) tra ve fallback mac dinh', () => {
    expect(extractErrorMessage(new Error('loi khong lien quan API'))).toBeTruthy();
  });
});
