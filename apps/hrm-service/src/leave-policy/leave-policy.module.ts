import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeavePolicy } from '../entities/leave-policy.entity';
import { LeavePolicyService } from './leave-policy.service';
import { LeavePolicyController } from './leave-policy.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeavePolicy])],
  providers: [LeavePolicyService],
  controllers: [LeavePolicyController],
  exports: [LeavePolicyService],
})
export class LeavePolicyModule {}
