export * from './events/event-types';
export * from './events/event-envelope';
// 28/07/2026: export schema DLQ dung chung (xem events/dead-letter-envelope.ts)
export * from './events/dead-letter-envelope';
export * from './dto/pagination.dto';
export * from './dto/error-response.dto';
export * from './enums/task-status.enum';
export * from './enums/permission.enum';
// 04/08/2026: CRM-lite - xem enums/deal-stage.enum.ts.
export * from './enums/deal-stage.enum';
// 05/08/2026: HRM-lite - xem enums/leave-request-status.enum.ts.
export * from './enums/leave-request-status.enum';
// 15/09/2026: Lich cong ty (HRM-lite mo rong) - xem enums/calendar-event-type.enum.ts.
export * from './enums/calendar-event-type.enum';
// 15/10/2026: Inventory Service (Danh muc san pham + Kho) - xem enums/stock-movement-type.enum.ts.
export * from './enums/stock-movement-type.enum';
export * from './interfaces/auth-context.interface';
export * from './constants/public-routes';
// 22/07/2026: export hang so bi mat noi bo dung chung (xem constants/internal-shared-secret.constant.ts)
export * from './constants/internal-shared-secret.constant';
// 20/08/2026: danh muc ma loi may doc duoc, dung cho rollout i18n (xem constants/error-codes.constant.ts)
export * from './constants/error-codes.constant';
// 22/08/2026: ten header correlation ID dung chung Gateway <-> cac service (xem constants/correlation-id.constant.ts)
export * from './constants/correlation-id.constant';
