import { SetMetadata } from '@nestjs/common';

/** Danh dau endpoint khong yeu cau InternalAuthGuard (vd: auth.controller cua IAM). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
