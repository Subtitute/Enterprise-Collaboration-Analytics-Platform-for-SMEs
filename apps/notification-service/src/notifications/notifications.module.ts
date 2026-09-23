import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { RealtimeModule } from '../realtime/realtime.module';
// 23/09/2026: NotificationsService gio can 2 read-model nay de suy ra pham vi hien thi thong bao
// (to chuc/phong ban/ca nhan) - xem resolveVisibleUserIds().
import { OrgMembersModule } from '../org-members/org-members.module';
import { DepartmentManagersModule } from '../department-managers/department-managers.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
    RealtimeModule,
    OrgMembersModule,
    DepartmentManagersModule,
  ],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
