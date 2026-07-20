import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthContext } from '@app/common-dto';

/** Lay AuthContext (hoac 1 truong cu the) da duoc InternalAuthGuard gan vao req.user. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthContext | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const user: AuthContext | undefined = req.user;
    return data ? user?.[data] : user;
  },
);
