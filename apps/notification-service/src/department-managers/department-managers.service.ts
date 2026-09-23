import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DepartmentManager, DepartmentManagerDocument } from './schemas/department-manager.schema';

/**
 * 23/09/2026: xem chu thich tong quan tai schemas/department-manager.schema.ts. Duoc
 * KafkaConsumerService goi de duy tri read-model tu EVENT_TYPES.DEPARTMENT_MANAGER_CHANGED, va
 * duoc NotificationsService goi de tra cuu pham vi hien thi thong bao cua 1 Manager.
 */
@Injectable()
export class DepartmentManagersService {
  constructor(
    @InjectModel(DepartmentManager.name) private readonly model: Model<DepartmentManagerDocument>,
  ) {}

  async setManager(organizationId: string, departmentId: string, managerId: string | null): Promise<void> {
    await this.model.updateOne({ organizationId, departmentId }, { $set: { managerId } }, { upsert: true });
  }

  /** Danh sach departmentId ma `managerId` nay dang la nguoi phu trach, trong 1 to chuc. */
  async listDepartmentIdsManagedBy(organizationId: string, managerId: string): Promise<string[]> {
    const docs = await this.model.find({ organizationId, managerId }).select('departmentId').lean();
    return docs.map((d) => d.departmentId);
  }
}
