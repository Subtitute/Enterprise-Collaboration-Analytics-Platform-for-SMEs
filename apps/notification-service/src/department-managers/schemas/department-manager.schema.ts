import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DepartmentManagerDocument = HydratedDocument<DepartmentManager>;

/**
 * Collection `department_managers` (MongoDB) - 23/09/2026, bo sung cho tinh nang "Manager chi
 * thay thong bao cua phong ban minh phu trach" (xem NotificationsService.resolveVisibleUserIds()).
 * Department (va Department.managerId - nguoi phu trach) thuoc so huu cua IAM Service; Notification
 * Service khong duoc phep doc truc tiep DB cua IAM Service (database-per-service), nen tu xay 1
 * read-model cuc bo bang cach tieu thu event EVENT_TYPES.DEPARTMENT_MANAGER_CHANGED - mirror dung
 * tinh than OrgMember (org-members/schemas/org-member.schema.ts) cho bai toan tuong tu.
 */
@Schema({ collection: 'department_managers', timestamps: { createdAt: true, updatedAt: true } })
export class DepartmentManager {
  @Prop({ required: true })
  organizationId: string;

  @Prop({ required: true })
  departmentId: string;

  /** null nghia la phong ban hien khong co nguoi phu trach. */
  @Prop({ type: String, default: null })
  managerId: string | null;
}

export const DepartmentManagerSchema = SchemaFactory.createForClass(DepartmentManager);

// Unique theo cap (organizationId, departmentId) - moi lan sync (upsert) ghi de len ban ghi cu.
DepartmentManagerSchema.index({ organizationId: 1, departmentId: 1 }, { unique: true });
// Phuc vu truy van chinh: "danh sach departmentId ma 1 nguoi dang la nguoi phu trach".
DepartmentManagerSchema.index({ organizationId: 1, managerId: 1 });
