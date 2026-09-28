/**
 * Loai cuoc tro chuyen. Khai bao CUC BO trong messaging-service (khong dua vao packages/common-dto
 * nhu DealStage/LeaveRequestStatus) vi khong service nao khac tieu thu gia tri nay - messaging
 * khong phat Kafka event (xem chu thich trong app.module.ts).
 */
export enum ConversationType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
}
