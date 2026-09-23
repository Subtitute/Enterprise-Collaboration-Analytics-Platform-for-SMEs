import { IsUUID } from 'class-validator';

/** 22/09/2026: DTO them 1 thanh vien vao du an - xem ProjectMember (entities/project-member.entity.ts). */
export class AddProjectMemberDto {
  @IsUUID('4', { message: 'userId phai la UUID hop le' })
  userId: string;
}
