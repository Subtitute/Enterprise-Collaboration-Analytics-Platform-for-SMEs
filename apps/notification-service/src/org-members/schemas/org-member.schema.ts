import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OrgMemberDocument = HydratedDocument<OrgMember>;

/**
 * Collection `org_members` (MongoDB) - 17/09/2026, bo sung cho tinh nang thong bao toan to chuc
 * (vd cong bo ngay nghi le, xem buildBroadcastNotificationTemplate() tai
 * kafka/event-notification-builder.ts). Notification Service KHONG doc truc tiep DB cua IAM Service
 * (moi service so huu du lieu rieng - Technical_Spec.md muc 4 "database-per-service", chua co ha
 * tang goi HTTP noi bo xuyen service trong repo), nen tu xay 1 "read-model" cuc bo (danh sach
 * userId active cua tung to chuc) bang cach tieu thu 2 event da co san tren KAFKA_TOPICS.IAM
 * (USER_REGISTERED/USER_DEACTIVATED, deu da duoc consumer nay subscribe tu truoc) - mirror dung
 * tinh than UserDepartmentSyncService (apps/iam-service) da lam cho Analytics Service voi bai toan
 * tuong tu (KPI theo phong ban).
 */
@Schema({ collection: 'org_members', timestamps: { createdAt: true, updatedAt: true } })
export class OrgMember {
  @Prop({ required: true })
  organizationId: string;

  @Prop({ required: true })
  userId: string;

  /** false khi user bi vo hieu hoa (USER_DEACTIVATED) - khong dua vao danh sach fan-out thong bao. */
  @Prop({ default: true })
  isActive: boolean;

  /**
   * 23/09/2026: bo sung cho tinh nang "Manager chi thay thong bao cua phong ban minh phu trach"
   * (xem DepartmentManager schema + NotificationsService.resolveVisibleUserIds()) - dong bo tu
   * USER_REGISTERED (co san departmentId luc tao) va USER_DEPARTMENT_CHANGED (xem
   * KafkaConsumerService.syncOrgMembership()). `null`/undefined nghia la user hien khong thuoc
   * phong ban nao.
   */
  @Prop({ type: String, default: null })
  departmentId?: string | null;
}

export const OrgMemberSchema = SchemaFactory.createForClass(OrgMember);

// Unique theo cap (organizationId, userId) - moi lan sync (upsert) ghi de len ban ghi cu, khong
// tao trung du event USER_REGISTERED co the duoc redeliver (idempotent).
OrgMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
// Phuc vu truy van chinh: "danh sach userId active cua 1 to chuc" (listActiveUserIds()).
OrgMemberSchema.index({ organizationId: 1, isActive: 1 });
// 23/09/2026: phuc vu truy van "danh sach userId active thuoc 1 tap phong ban" (xem
// listActiveUserIdsInDepartments()).
OrgMemberSchema.index({ organizationId: 1, departmentId: 1 });
