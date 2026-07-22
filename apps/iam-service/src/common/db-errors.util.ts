/**
 * 22/07/2026: tien ich dung chung cho AuthService.registerOrganization() va UsersService.invite()
 * - ca 2 cho deu lam pre-check `findOne({ where: { email } })` ROI MOI `save()` (2 buoc rieng,
 * khong nguyen tu) de bao loi 409 "Email da duoc su dung" than thien cho nguoi dung, nhung van bo
 * ngo 1 khoang trong nho giua 2 buoc do: neu 2 request dang ky/moi cung 1 email toi GAN NHU DONG
 * THOI, ca hai co the cung vuot qua pre-check (vi luc do chua co ban ghi nao) roi cung insert,
 * ben insert sau vi pham unique index `email` o entity User (xem user.entity.ts) va nem loi DB
 * tho (Postgres error code 23505) thay vi ConflictException - lot ra thanh HTTP 500 chung chung
 * cho client (loi MINOR, review 22/07/2026). Ham nay dung de nhan dien loi do trong catch block va
 * chuyen no thanh ConflictException 409 dung nghia.
 */
export function isPostgresUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}
