import { IsArray, IsOptional, IsUUID } from 'class-validator';

/** PATCH /conversations/:id/participants - chi ap dung cho GROUP (kiem tra o service layer). */
export class UpdateParticipantsDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  addUserIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  removeUserIds?: string[];
}
