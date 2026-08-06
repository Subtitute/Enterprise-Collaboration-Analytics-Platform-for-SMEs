import { IsEnum } from 'class-validator';
import { DealStage } from '@app/common-dto';

/** Body cho PATCH /deals/:id/stage - endpoint keo-tha Kanban pipeline ban hang (Wireframe.md muc 12). */
export class UpdateDealStageDto {
  @IsEnum(DealStage, { message: 'Giai doan deal khong hop le' })
  stage: DealStage;
}
