import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { timingSafeEqual } from 'crypto';
import { Public } from '@app/common-guard';
import { DEV_FALLBACK_INTERNAL_SHARED_SECRET, INTERNAL_SHARED_SECRET_HEADER } from '@app/common-dto';
import { ProjectMembershipSnapshot, ProjectMembershipSnapshotService } from './project-membership-snapshot.service';

/** So sanh bi mat theo thoi gian hang (khong lo do dai/khop dan tung ky tu qua do tre). */
export function isValidInternalSecret(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * 26/10/2026: endpoint NOI BO service-to-service (Document Service backfill read-model thanh vien
 * du an) - `GET /api/v1/internal/project-memberships`. Khong thuoc nguoi dung/to chuc nao nen danh
 * dau @Public() (InternalAuthGuard doi header x-user-id/x-org-id cua Gateway) va TU kiem tra
 * `x-internal-secret`. Gateway KHONG dinh tuyen tien to /api/v1/internal (proxy-routes.config.ts)
 * va cong 3002 khong mo ra host, nen chi container trong internal-net goi duoc; bi mat la lop thu 2.
 * Gia tri mong doi giong InternalAuthGuard: production thieu INTERNAL_SHARED_SECRET thi guard da
 * chan service khoi dong, nen fallback dev o day khong bao gio ap dung o production.
 */
@ApiExcludeController()
@Public()
@Controller('internal/project-memberships')
export class InternalProjectMembershipsController {
  constructor(private readonly snapshotService: ProjectMembershipSnapshotService) {}

  @Get()
  snapshot(@Headers(INTERNAL_SHARED_SECRET_HEADER) secret?: string): Promise<ProjectMembershipSnapshot> {
    const expected = process.env.INTERNAL_SHARED_SECRET || DEV_FALLBACK_INTERNAL_SHARED_SECRET;
    if (!isValidInternalSecret(secret, expected)) {
      throw new UnauthorizedException('Thieu hoac sai internal shared-secret');
    }
    return this.snapshotService.snapshot();
  }
}
