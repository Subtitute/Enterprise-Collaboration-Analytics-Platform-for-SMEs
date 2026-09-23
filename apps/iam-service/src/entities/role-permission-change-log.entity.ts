import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';

/**
 * 22/09/2026: Nhat ky thay doi quyen han cua vai tro (RBAC audit log) - theo yeu cau tu de xuat cua
 * Tien: "Vai trò & phân quyền - Không thể tự nâng quyền; log mọi thay đổi". Ghi 1 dong MOI lan
 * RolesService.updateRolePermissions() thuc su thay doi tap quyen cua 1 vai tro (bo qua neu goi
 * PATCH nhung tap quyen KHONG doi - xem RolesService). `previousPermissionKeys`/`newPermissionKeys`
 * luu snapshot day du (khong chi phan chenh lech) de doc lai lich su ro rang, khong can doi chieu
 * nguoc giua nhieu dong.
 */
@Entity('role_permission_change_logs')
export class RolePermissionChangeLog extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'role_id' })
  roleId: string;

  /** Chup lai ten vai tro tai thoi diem doi - de doc lich su van ro nghia neu vai tro bi xoa sau nay. */
  @Column({ name: 'role_name' })
  roleName: string;

  // User song trong CUNG database cua IAM Service (khac cac service khac) - van khong dung quan he
  // FK truc tiep toi User de nhat quan voi quy uoc chung toan repo (tranh rang buoc cung nhac khi
  // User bi xoa) va giu entity nay don gian, chi phuc vu doc lich su.
  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ name: 'previous_permission_keys', type: 'jsonb' })
  previousPermissionKeys: string[];

  @Column({ name: 'new_permission_keys', type: 'jsonb' })
  newPermissionKeys: string[];
}
