import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrgMember, OrgMemberSchema } from './schemas/org-member.schema';
import { OrgMembersService } from './org-members.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: OrgMember.name, schema: OrgMemberSchema }])],
  providers: [OrgMembersService],
  exports: [OrgMembersService],
})
export class OrgMembersModule {}
