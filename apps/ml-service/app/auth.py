"""24/09/2026: mirror CHINH XAC packages/common-guard/src/guards/internal-auth.guard.ts +
permissions.guard.ts phia Node - ml-service KHONG phai Nest service nen khong dung lai duoc
@app/common-guard truc tiep (khac ngon ngu), phai tu viet lai cung logic bang FastAPI dependency.

Bien gioi tin cay: service nay chi dat trong internal-net (khong expose ra host - xem
docker-compose.yml), nhung van bat buoc kiem tra header `x-internal-secret` truoc khi tin BAT KY
header context nao, de phong truong hop 1 client bo qua Gateway va goi thang vao service."""

from dataclasses import dataclass, field

from fastapi import Header, HTTPException, status

from app.config import INTERNAL_SHARED_SECRET

ML_VIEW_PERMISSION = "ml:view"
USER_MANAGE_PERMISSION = "user:manage"
# 24/10/2026: Face recognition cho cham cong - dung LAI permission attendance:checkin da co
# (khong them permission moi rieng) vi day la hanh dong TU PHUC VU gan lien attendance:checkin
# (dang ky/kiem tra khuon mat CUA CHINH MINH, mirror dung logic "ai co the tu cham cong thi cung
# tu dang ky khuon mat duoc" - khong can tach quyen rieng, dung tinh than toi gian ClaudeRule.md
# muc 8).
ATTENDANCE_CHECKIN_PERMISSION = "attendance:checkin"
# 26/10/2026: kho anh nhan dien (Technical_Spec.md muc 27.7) - "quyen cap Manager" cua nhom IAM,
# dung DUNG tham so resolveDataScope(permissions, PERMISSIONS.USER_INVITE, departmentId) ma
# iam-service dang dung cho danh ba (packages/common-dto/src/constants/data-scope.ts).
USER_INVITE_PERMISSION = "user:invite"


@dataclass
class AuthContext:
    user_id: str
    organization_id: str
    permissions: list[str] = field(default_factory=list)
    # 26/10/2026: doc them x-roles/x-department-id/x-is-super-admin (Gateway da forward san tu JWT)
    # de xac dinh pham vi Manager theo phong ban va chan Super Admin khoi du lieu tenant.
    roles: list[str] = field(default_factory=list)
    department_id: str | None = None
    is_super_admin: bool = False

    @property
    def is_org_admin(self) -> bool:
        # 24/09/2026: mirror dung quy uoc cua AnalyticsService.getDrillDown()/getRecentActivity()
        # phia Node - "Org Admin" o day nghia la co quyen USER_MANAGE (khong phai 1 role rieng),
        # khong dinh nghia lai khai niem moi.
        return USER_MANAGE_PERMISSION in self.permissions

    @property
    def data_scope(self) -> str:
        """26/10/2026: ban Python cua resolveDataScope() - 'organization' | 'department' | 'self'."""
        if self.is_org_admin:
            return "organization"
        if USER_INVITE_PERMISSION in self.permissions and self.department_id:
            return "department"
        return "self"


def _parse_list_header(value: str | None) -> list[str]:
    if not value:
        return []
    return [v.strip() for v in value.split(",") if v.strip()]


async def get_auth_context(
    x_internal_secret: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
    x_org_id: str | None = Header(default=None),
    x_permissions: str | None = Header(default=None),
    x_roles: str | None = Header(default=None),
    x_department_id: str | None = Header(default=None),
    x_is_super_admin: str | None = Header(default=None),
) -> AuthContext:
    if not x_internal_secret or x_internal_secret != INTERNAL_SHARED_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Thieu hoac sai internal shared-secret - yeu cau phai di qua API Gateway",
        )
    if not x_user_id or not x_org_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Thieu thong tin xac thuc noi bo - yeu cau phai di qua API Gateway",
        )
    return AuthContext(
        user_id=x_user_id,
        organization_id=x_org_id,
        permissions=_parse_list_header(x_permissions),
        roles=_parse_list_header(x_roles),
        department_id=(x_department_id or "").strip() or None,
        is_super_admin=(x_is_super_admin or "").strip().lower() == "true",
    )


def require_ml_view(ctx: AuthContext) -> None:
    if ML_VIEW_PERMISSION not in ctx.permissions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Thieu quyen ml:view")


def require_attendance_checkin(ctx: AuthContext) -> None:
    if ATTENDANCE_CHECKIN_PERMISSION not in ctx.permissions:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Thieu quyen attendance:checkin")
