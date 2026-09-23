import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrgMember, OrgMemberDocument } from './schemas/org-member.schema';

/**
 * 17/09/2026: xem chu thich tong quan tai schemas/org-member.schema.ts. Duoc KafkaConsumerService
 * goi de (a) duy tri read-model tu USER_REGISTERED/USER_DEACTIVATED, va (b) tra cuu danh sach
 * nguoi nhan khi fan-out 1 thong bao toan to chuc.
 */
@Injectable()
export class OrgMembersService {
  constructor(@InjectModel(OrgMember.name) private readonly orgMemberModel: Model<OrgMemberDocument>) {}

  // 23/09/2026: bo sung tham so departmentId (tuy chon) - USER_REGISTERED da mang san departmentId
  // luc tao user (xem UserRegisteredPayload), ghi luon vao day thay vi cho 1 event
  // USER_DEPARTMENT_CHANGED rieng biet ngay sau do (organizationId+userId da unique nen upsert an toan).
  async markActive(organizationId: string, userId: string, departmentId?: string | null): Promise<void> {
    const setFields: Record<string, unknown> = { isActive: true };
    if (departmentId !== undefined) setFields.departmentId = departmentId;
    await this.orgMemberModel.updateOne({ organizationId, userId }, { $set: setFields }, { upsert: true });
  }

  async markInactive(organizationId: string, userId: string): Promise<void> {
    await this.orgMemberModel.updateOne(
      { organizationId, userId },
      { $set: { isActive: false } },
      { upsert: true },
    );
  }

  /** 23/09/2026: dong bo tu EVENT_TYPES.USER_DEPARTMENT_CHANGED - xem kafka-consumer.service.ts. */
  async setDepartment(organizationId: string, userId: string, departmentId: string | null): Promise<void> {
    await this.orgMemberModel.updateOne({ organizationId, userId }, { $set: { departmentId } }, { upsert: true });
  }

  async listActiveUserIds(organizationId: string): Promise<string[]> {
    const docs = await this.orgMemberModel.find({ organizationId, isActive: true }).select('userId').lean();
    return docs.map((d) => d.userId);
  }

  /**
   * 23/09/2026: danh sach userId active thuoc 1 TAP phong ban cho truoc - dung boi
   * NotificationsService.resolveVisibleUserIds() de xac dinh pham vi hien thi thong bao cua 1
   * Manager (phong ban ho phu trach, xem DepartmentManagersService).
   */
  async listActiveUserIdsInDepartments(organizationId: string, departmentIds: string[]): Promise<string[]> {
    if (departmentIds.length === 0) return [];
    const docs = await this.orgMemberModel
      .find({ organizationId, isActive: true, departmentId: { $in: departmentIds } })
      .select('userId')
      .lean();
    return docs.map((d) => d.userId);
  }
}
