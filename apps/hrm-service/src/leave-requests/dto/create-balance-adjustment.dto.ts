import { Allow } from 'class-validator';

/**
 * 04/11/2026: body POST /leave-requests/balance-adjustments. @Allow() chi de truong qua duoc whitelist -
 * kiem tra nam o LeaveRequestsService.createBalanceAdjustment() de moi sai sot deu tra cung ma
 * LEAVE_ADJUSTMENT_INVALID.
 */
export class CreateBalanceAdjustmentDto {
  @Allow()
  userId: string;

  @Allow()
  year: number;

  /** So nguyen khac 0, am duoc. */
  @Allow()
  days: number;

  @Allow()
  note: string;
}
