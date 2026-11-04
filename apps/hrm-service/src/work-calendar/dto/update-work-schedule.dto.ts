import { Allow } from 'class-validator';

/**
 * 04/11/2026: body PUT /work-calendar/schedule, moi truong tuy chon (khong gui thi giu gia tri hien tai).
 * @Allow() chi de truong qua duoc whitelist - kiem tra nam tap trung o findWorkScheduleError() de moi sai
 * sot deu tra cung ma WORK_SCHEDULE_INVALID.
 */
export class UpdateWorkScheduleDto {
  @Allow()
  workingWeekdays?: number[];

  @Allow()
  workStart?: string;

  @Allow()
  workEnd?: string;

  @Allow()
  lateGraceMinutes?: number;

  @Allow()
  earlyLeaveGraceMinutes?: number;

  @Allow()
  breakMinutes?: number;
}
