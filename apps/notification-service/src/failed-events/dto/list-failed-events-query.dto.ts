import { PaginationQueryDto } from '@app/common-dto';

/**
 * 28/07/2026: query cho `GET /failed-events` (Technical_Spec.md muc 14 - nang cap Dead Letter
 * Queue). MAU THAM CHIEU: notifications/dto/list-notifications-query.dto.ts, nhung hien tai
 * CHUA can filter rieng nao ngoai phan trang chuan (page/limit) ke thua tu PaginationQueryDto -
 * danh sach nay chi loc theo to chuc (lay tu @CurrentUser, khong phai query param).
 */
export class ListFailedEventsQueryDto extends PaginationQueryDto {}
