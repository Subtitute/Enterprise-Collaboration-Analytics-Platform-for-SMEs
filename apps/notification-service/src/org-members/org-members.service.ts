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

  async markActive(organizationId: string, userId: string): Promise<void> {
    await this.orgMemberModel.updateOne(
      { organizationId, userId },
      { $set: { isActive: true } },
      { upsert: true },
    );
  }

  async markInactive(organizationId: string, userId: string): Promise<void> {
    await this.orgMemberModel.updateOne(
      { organizationId, userId },
      { $set: { isActive: false } },
      { upsert: true },
    );
  }

  async listActiveUserIds(organizationId: string): Promise<string[]> {
    const docs = await this.orgMemberModel.find({ organizationId, isActive: true }).select('userId').lean();
    return docs.map((d) => d.userId);
  }
}
