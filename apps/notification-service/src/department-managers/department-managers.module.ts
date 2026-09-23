import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DepartmentManager, DepartmentManagerSchema } from './schemas/department-manager.schema';
import { DepartmentManagersService } from './department-managers.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: DepartmentManager.name, schema: DepartmentManagerSchema }])],
  providers: [DepartmentManagersService],
  exports: [DepartmentManagersService],
})
export class DepartmentManagersModule {}
