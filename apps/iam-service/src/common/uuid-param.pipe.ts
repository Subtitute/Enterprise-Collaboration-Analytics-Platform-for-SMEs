import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/**
 * 25/07/2026: pipe dung chung cho moi route param `:id` kieu UUID (users/departments/roles
 * controller) - truoc day cac controller nay truyen thang `@Param('id') id: string` vao thang
 * TypeORM Repository.findOne({ where: { id } })/delete({ id }) ma khong validate dinh dang truoc.
 * 1 UUID sai dinh dang (vd ":id" = "abc") lam Postgres nem loi kieu du lieu ("invalid input syntax
 * for type uuid", TypeORM QueryFailedError) - loi nay KHONG duoc AllExceptionsFilter
 * (packages/common-guard) nhan dien la loi client nen roi xuong HTTP 500 chung chung ("Da xay ra
 * loi khong xac dinh") thay vi 400 "du lieu dau vao khong hop le" dung nghia hon nhieu (loi MINOR,
 * review 25/07/2026). ParseUUIDPipe mac dinh (KHONG truyen `version`) chap nhan ca UUID v1-v5,
 * khop voi cach cac DTO khac trong service nay dung @IsUUID() KHONG rang buoc version cu the (vd
 * UpdateUserDto.departmentId) - tranh 400 gia cho UUID hop le nhung khac version.
 */
export const uuidParamPipe = (): ParseUUIDPipe =>
  new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException('ID khong hop le, phai la dinh dang UUID'),
  });
