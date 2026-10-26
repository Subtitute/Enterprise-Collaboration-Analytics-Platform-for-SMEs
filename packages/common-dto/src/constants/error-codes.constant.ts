// 20/08/2026: danh muc ma loi may doc duoc (Doc/ClaudeRule.md - rollout i18n Viet/Anh/Nhat cho
// apps/web). Truoc day, moi loi nghiep vu (`throw new XException('chuoi tieng Viet')`) chi co
// message tu do tieng Viet - client (web/mobile) chi hien thi NGUYEN VAN chuoi do, khong the
// dich sang ngon ngu khac. `error` field cua AllExceptionsFilter KHONG dung duoc lam ma - NestJS
// tu dien thanh cum tieng Anh co dinh theo class exception (vd 'Not Found' cho CA "khong tim thay
// nguoi dung" LAN "khong tim thay du an"), khong phan biet duoc tung tinh huong nghiep vu.
//
// Co che moi HOAN TOAN CONG THEM (additive) - message tieng Viet hien co GIU NGUYEN o moi diem
// throw, chi bo sung errorCode/errorParams di kem. Web dung errorCode de dich qua i18next (xem
// apps/web/src/lib/api-client.ts, extractErrorMessage), mobile (ecap-mobile) khong doc field nay,
// tiep tuc hien thi message tieng Viet nhu truoc - khong anh huong.
//
// Quy uoc dat ten: SCREAMING_SNAKE_CASE, nhom theo domain nghiep vu bang comment, gia tri CHUOI
// TRUNG VOI TEN KEY (de doc/debug/grep truc tiep tren payload JSON). Danh sach nay duoc chot 1
// lan (Doc/plan i18n) truoc khi cac batch migrate tung service chay song song, tranh dat ten
// trung/lech giua cac batch.
export const ERROR_CODES = {
  // ---- Xac thuc/JWT (Gateway - qua sendErrorResponse, KHONG di qua AllExceptionsFilter) ----
  GATEWAY_MISSING_TOKEN: 'GATEWAY_MISSING_TOKEN',
  GATEWAY_INVALID_TOKEN: 'GATEWAY_INVALID_TOKEN',
  GATEWAY_ACCOUNT_DISABLED: 'GATEWAY_ACCOUNT_DISABLED',
  GATEWAY_RATE_LIMITED: 'GATEWAY_RATE_LIMITED',
  GATEWAY_PROXY_FAILED: 'GATEWAY_PROXY_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // ---- IAM: users ----
  FORBIDDEN_SELF_PROFILE_ONLY: 'FORBIDDEN_SELF_PROFILE_ONLY',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_ALREADY_USED: 'EMAIL_ALREADY_USED',
  DEPARTMENT_NOT_FOUND: 'DEPARTMENT_NOT_FOUND',
  FORBIDDEN_ASSIGN_ROLE: 'FORBIDDEN_ASSIGN_ROLE',
  FORBIDDEN_CHANGE_ROLE: 'FORBIDDEN_CHANGE_ROLE',
  CANNOT_DEACTIVATE_SELF: 'CANNOT_DEACTIVATE_SELF',
  CANNOT_DELETE_SELF: 'CANNOT_DELETE_SELF',
  CANNOT_DELETE_ACTIVE_USER: 'CANNOT_DELETE_ACTIVE_USER',

  // ---- IAM: auth ----
  MISSING_REFRESH_TOKEN: 'MISSING_REFRESH_TOKEN',
  EMAIL_ALREADY_USED_BY_ORG: 'EMAIL_ALREADY_USED_BY_ORG',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  // 22/08/2026: chan brute-force dang nhap THEO TAI KHOAN CU THE (khac voi rate-limit theo IP da
  // co san o Gateway - xem chu thich trong AuthService.login()).
  TOO_MANY_LOGIN_ATTEMPTS: 'TOO_MANY_LOGIN_ATTEMPTS',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_REVOKED: 'REFRESH_TOKEN_REVOKED',
  USER_INACTIVE_OR_MISSING: 'USER_INACTIVE_OR_MISSING',
  REFRESH_TOKEN_NOT_FOUND_OR_REVOKED: 'REFRESH_TOKEN_NOT_FOUND_OR_REVOKED',
  // 15/09/2026: "Quen mat khau" - 1 ma DUY NHAT cho MOI ly do token khong dung duoc (khong tim
  // thay/da het han/da dung roi) - co y KHONG tach rieng tung ly do (giong REFRESH_TOKEN_INVALID
  // vs REFRESH_TOKEN_REVOKED o tren) vi day la luong CONG KHAI (khong dang nhap), tiet lo chinh
  // xac ly do that bai co the giup ke tan cong do doan trang thai token/tai khoan.
  PASSWORD_RESET_TOKEN_INVALID: 'PASSWORD_RESET_TOKEN_INVALID',

  // ---- IAM: roles ----
  ROLE_NOT_FOUND: 'ROLE_NOT_FOUND',
  // 20/08/2026: co y KHONG gan ma cho loi "permission key khong hop le" (roles.service.ts) - ca
  // bien admin/dev hiem gap, roi ve message tieng Viet qua defaultValue cua i18next (xem plan).
  // 22/09/2026: chan tu doi quyen cho DUNG vai tro ma nguoi goi dang giu (RBAC audit - "khong the
  // tu nang quyen"). Xem RolesService.updateRolePermissions().
  FORBIDDEN_SELF_ROLE_PERMISSION_CHANGE: 'FORBIDDEN_SELF_ROLE_PERMISSION_CHANGE',

  // ---- IAM: platform-admin (Super Admin, bo sung 16/09/2026) ----
  // Endpoint /platform-admin/* CHI danh cho Super Admin (quan tri nen tang, khong thuoc 1 to
  // chuc nghiep vu nao) - xem SuperAdminGuard (@app/common-guard) va User.isSuperAdmin.
  FORBIDDEN_SUPER_ADMIN_ONLY: 'FORBIDDEN_SUPER_ADMIN_ONLY',
  // Dung chung cho ca 2 truong hop id sai VA id trung dung to chuc he thong (Organization.isSystem,
  // noi "an cu" cua chinh tai khoan Super Admin) - to chuc he thong khong hien trong danh sach
  // quan ly nen coi nhu "khong ton tai" doi voi API nay, khong can ma loi rieng.
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',

  // ---- Project & Task ----
  PROJECT_NOT_FOUND_IN_ORG: 'PROJECT_NOT_FOUND_IN_ORG',
  TASK_STATUS_TRANSITION_INVALID: 'TASK_STATUS_TRANSITION_INVALID',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  PROJECT_ALREADY_COMPLETED: 'PROJECT_ALREADY_COMPLETED',
  PROJECT_ALREADY_ARCHIVED: 'PROJECT_ALREADY_ARCHIVED',
  // 22/09/2026: ProjectMember (thanh vien du an that su, thay the localStorage o frontend).
  PROJECT_MEMBER_IS_LEAD: 'PROJECT_MEMBER_IS_LEAD',
  // 26/10/2026: go thanh vien con Task chua xong trong du an (409) - phai giao lai Task truoc.
  PROJECT_MEMBER_HAS_OPEN_TASKS: 'PROJECT_MEMBER_HAS_OPEN_TASKS',

  // ---- Document ----
  MISSING_UPLOAD_FILE: 'MISSING_UPLOAD_FILE',
  INVALID_FOLDER_ID: 'INVALID_FOLDER_ID',
  PARENT_FOLDER_NOT_FOUND: 'PARENT_FOLDER_NOT_FOUND',
  FOLDER_NOT_FOUND: 'FOLDER_NOT_FOUND',
  FORBIDDEN_FOLDER_ACCESS: 'FORBIDDEN_FOLDER_ACCESS',
  FORBIDDEN_FOLDER_MODIFY: 'FORBIDDEN_FOLDER_MODIFY',
  SHARE_TARGET_REQUIRED: 'SHARE_TARGET_REQUIRED',
  FOLDER_ALREADY_SHARED: 'FOLDER_ALREADY_SHARED',
  SHARE_NOT_FOUND: 'SHARE_NOT_FOUND',
  FORBIDDEN_FILE_ACCESS: 'FORBIDDEN_FILE_ACCESS',
  FORBIDDEN_FILE_LIST_ACCESS: 'FORBIDDEN_FILE_LIST_ACCESS',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_NAME_TOO_LONG: 'FILE_NAME_TOO_LONG',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  // 24/10/2026: tim kiem ngu nghia tai lieu (RAG, POST /files/search-chunks) - loi tam thoi khi goi
  // API nhung cau hoi (Gemini qua tai/het han ngach). RAG CHUA cau hinh (thieu GEMINI_API_KEY) KHONG
  // dung ma nay - endpoint tra ket qua rong kem co `ragEnabled: false`, xem DocumentSearchService.
  DOCUMENT_SEARCH_UNAVAILABLE: 'DOCUMENT_SEARCH_UNAVAILABLE',
  // 24/10/2026: 1 nguoi dung goi search-chunks qua nhieu lan trong 1 khung thoi gian (429) - bao ve
  // han ngach Gemini dung CHUNG cho toan nen tang, xem SEARCH_RATE_LIMIT trong DocumentSearchService.
  DOCUMENT_SEARCH_RATE_LIMITED: 'DOCUMENT_SEARCH_RATE_LIMITED',
  // 26/10/2026: tai lieu theo pham vi du an - chi Org Admin tao/chuyen duoc thu muc toan cong ty
  // (khong gan du an) va tai tep len thu muc goc; nguoi khac phai chon 1 du an minh thuoc pham vi.
  COMPANY_WIDE_ADMIN_ONLY: 'COMPANY_WIDE_ADMIN_ONLY',
  FORBIDDEN_PROJECT_DOCUMENTS: 'FORBIDDEN_PROJECT_DOCUMENTS',
  FOLDER_PROJECT_TOP_LEVEL_ONLY: 'FOLDER_PROJECT_TOP_LEVEL_ONLY',
  // 26/10/2026: cay toan cong ty (thu muc khong du an) chi Org Admin ghi - nguoi khac chi xem (tru khi duoc chia se tuong minh).
  COMPANY_WIDE_READ_ONLY: 'COMPANY_WIDE_READ_ONLY',

  // ---- HRM-lite: attendance/leave ----
  MISSING_CHECKIN_PHOTO: 'MISSING_CHECKIN_PHOTO',
  INVALID_PHOTO_KIND: 'INVALID_PHOTO_KIND',
  LEAVE_DATE_RANGE_INVALID: 'LEAVE_DATE_RANGE_INVALID',
  LEAVE_START_DATE_IN_PAST: 'LEAVE_START_DATE_IN_PAST',
  LEAVE_REQUEST_NOT_FOUND: 'LEAVE_REQUEST_NOT_FOUND',
  LEAVE_REQUEST_ALREADY_DECIDED: 'LEAVE_REQUEST_ALREADY_DECIDED',
  ALREADY_CHECKED_IN_TODAY: 'ALREADY_CHECKED_IN_TODAY',
  NOT_CHECKED_IN_YET: 'NOT_CHECKED_IN_YET',
  ALREADY_CHECKED_OUT_TODAY: 'ALREADY_CHECKED_OUT_TODAY',
  ATTENDANCE_NOT_FOUND: 'ATTENDANCE_NOT_FOUND',
  FORBIDDEN_ATTENDANCE_PHOTO: 'FORBIDDEN_ATTENDANCE_PHOTO',
  ATTENDANCE_PHOTO_MISSING: 'ATTENDANCE_PHOTO_MISSING',
  INVALID_COORDINATE: 'INVALID_COORDINATE',
  PHOTO_CONTENT_MISMATCH: 'PHOTO_CONTENT_MISMATCH',
  // 24/10/2026: Face recognition (verify 1:1) cho cham cong - diem tuong dong (faceMatchScore)
  // doc THO tu multipart/form-data mirror dung latitude/longitude, xem face-match-score.util.ts.
  INVALID_FACE_MATCH_SCORE: 'INVALID_FACE_MATCH_SCORE',
  // 17/09/2026: chan cham cong vao ngay nghi le cong ty (CalendarEvent.type=HOLIDAY) - xem
  // AttendanceService.checkIn(), CalendarEventsService.findHolidayForDate().
  ATTENDANCE_BLOCKED_HOLIDAY: 'ATTENDANCE_BLOCKED_HOLIDAY',

  // ---- HRM-lite: lich cong ty (bo sung 15/09/2026) ----
  CALENDAR_EVENT_NOT_FOUND: 'CALENDAR_EVENT_NOT_FOUND',
  CALENDAR_EVENT_DATE_RANGE_INVALID: 'CALENDAR_EVENT_DATE_RANGE_INVALID',
  // 05/10/2026: cung loi logic da tung sua o LeaveRequestsService.create() (LEAVE_START_DATE_IN_PAST)
  // nhung CHUA tung ap dung cho lich cong ty - xem CalendarEventsService.
  CALENDAR_EVENT_START_DATE_IN_PAST: 'CALENDAR_EVENT_START_DATE_IN_PAST',
  // 03/10/2026: phan quyen lich cong ty mo rong - xem CalendarEventsService.
  CALENDAR_EVENT_FORBIDDEN_HOLIDAY: 'CALENDAR_EVENT_FORBIDDEN_HOLIDAY',
  CALENDAR_EVENT_FORBIDDEN_NOT_OWNER: 'CALENDAR_EVENT_FORBIDDEN_NOT_OWNER',
  CALENDAR_EVENT_FORBIDDEN_LOWER_RANK: 'CALENDAR_EVENT_FORBIDDEN_LOWER_RANK',

  // ---- HRM-lite: giai trinh/duyet cham cong va tang ca (bo sung 22/09/2026) ----
  ATTENDANCE_ADJUSTMENT_NOT_FOUND: 'ATTENDANCE_ADJUSTMENT_NOT_FOUND',
  ATTENDANCE_ADJUSTMENT_ALREADY_DECIDED: 'ATTENDANCE_ADJUSTMENT_ALREADY_DECIDED',
  ATTENDANCE_ADJUSTMENT_TOO_OLD: 'ATTENDANCE_ADJUSTMENT_TOO_OLD',
  ATTENDANCE_ADJUSTMENT_INVALID_RANGE: 'ATTENDANCE_ADJUSTMENT_INVALID_RANGE',
  OVERTIME_REQUEST_NOT_FOUND: 'OVERTIME_REQUEST_NOT_FOUND',
  OVERTIME_REQUEST_ALREADY_DECIDED: 'OVERTIME_REQUEST_ALREADY_DECIDED',
  OVERTIME_REQUEST_INVALID_RANGE: 'OVERTIME_REQUEST_INVALID_RANGE',
  OVERTIME_MONTHLY_CAP_EXCEEDED: 'OVERTIME_MONTHLY_CAP_EXCEEDED',

  // ---- CRM-lite ----
  CUSTOMER_NOT_FOUND_IN_ORG: 'CUSTOMER_NOT_FOUND_IN_ORG',
  DEAL_STAGE_TRANSITION_INVALID: 'DEAL_STAGE_TRANSITION_INVALID',
  DEAL_NOT_FOUND: 'DEAL_NOT_FOUND',
  CUSTOMER_NOT_FOUND: 'CUSTOMER_NOT_FOUND',

  // ---- Inventory Service: danh muc san pham + kho (bo sung 15/10/2026) ----
  PRODUCT_CATEGORY_NOT_FOUND: 'PRODUCT_CATEGORY_NOT_FOUND',
  // Khong cho xoa 1 danh muc con san pham thuoc ve no - xem Product.categoryId (onDelete: RESTRICT).
  PRODUCT_CATEGORY_HAS_PRODUCTS: 'PRODUCT_CATEGORY_HAS_PRODUCTS',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  PRODUCT_SKU_DUPLICATE: 'PRODUCT_SKU_DUPLICATE',
  // Khong cho xoa 1 san pham DA CO lich su giao dich - bao toan tinh toan ven du lieu phan tich xu
  // huong qua khu (xem CustomerPurchase.productId, onDelete: RESTRICT).
  PRODUCT_HAS_PURCHASE_HISTORY: 'PRODUCT_HAS_PURCHASE_HISTORY',
  WAREHOUSE_NOT_FOUND: 'WAREHOUSE_NOT_FOUND',
  // Khong cho xoa 1 kho con ton kho (quantity > 0) - phai xuat het hang truoc.
  WAREHOUSE_HAS_STOCK: 'WAREHOUSE_HAS_STOCK',
  // Xuat kho (OUT)/dieu chinh am vuot qua ton kho hien co - xem StockService.recordMovement().
  STOCK_INSUFFICIENT: 'STOCK_INSUFFICIENT',
  // IN voi quantityDelta am, hoac OUT voi quantityDelta duong - xem StockMovementType (@app/common-dto).
  STOCK_MOVEMENT_INVALID_DIRECTION: 'STOCK_MOVEMENT_INVALID_DIRECTION',
  CUSTOMER_PURCHASE_NOT_FOUND: 'CUSTOMER_PURCHASE_NOT_FOUND',

  // ---- Analytics ----
  AI_INSIGHT_NOT_CONFIGURED: 'AI_INSIGHT_NOT_CONFIGURED',
  AI_INSIGHT_GENERATION_FAILED: 'AI_INSIGHT_GENERATION_FAILED',
  INVALID_RANGE_WITH_QUARTER: 'INVALID_RANGE_WITH_QUARTER',
  INVALID_RANGE_NO_QUARTER: 'INVALID_RANGE_NO_QUARTER',
  DRILL_DOWN_SCOPE_FORBIDDEN: 'DRILL_DOWN_SCOPE_FORBIDDEN',

  // ---- Pham vi du lieu theo phong ban cua Manager (26/10/2026, xem constants/data-scope.ts) ----
  // Du lieu/phong ban duoc yeu cau nam NGOAI phong ban cua nguoi goi (Analytics departmentId, HRM duyet don).
  DEPARTMENT_SCOPE_FORBIDDEN: 'DEPARTMENT_SCOPE_FORBIDDEN',
  // Manager chua duoc gan phong ban nao nen khong co pham vi phong ban de xem so lieu.
  DEPARTMENT_SCOPE_MISSING: 'DEPARTMENT_SCOPE_MISSING',
  // Manager tu duyet/tu choi don (nghi phep/tang ca/giai trinh) cua chinh minh.
  SELF_APPROVAL_FORBIDDEN: 'SELF_APPROVAL_FORBIDDEN',

  // ---- Chat bot noi bo (Analytics Service, bo sung 24/10/2026 - Technical_Spec.md muc 23) ----
  CHATBOT_NOT_CONFIGURED: 'CHATBOT_NOT_CONFIGURED',
  CHATBOT_GENERATION_FAILED: 'CHATBOT_GENERATION_FAILED',
  // Vuot tran so cau hoi/ngay/nguoi dung (han ngach Gemini free tier dung chung voi "Nhan xet AI").
  CHATBOT_DAILY_LIMIT_EXCEEDED: 'CHATBOT_DAILY_LIMIT_EXCEEDED',
  // Dung chung cho id sai VA hoi thoai cua nguoi khac - khong lo lieu hoi thoai do co ton tai hay khong.
  CHATBOT_CONVERSATION_NOT_FOUND: 'CHATBOT_CONVERSATION_NOT_FOUND',
  // 24/10/2026: hoi thoai dang cho tra loi 1 cau hoi khac (gui dong thoi tu 2 tab/double-click) - 409.
  CHATBOT_CONVERSATION_BUSY: 'CHATBOT_CONVERSATION_BUSY',

  // ---- Notification ----
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',

  // ---- Validate DTO (vietnamese-validation.pipe.ts, CONSTRAINT_ERROR_CODES - 18 entry khop 1:1
  // voi CONSTRAINT_MESSAGE_BUILDERS) - params luon co { field: <ten property tho, KHONG dich,
  // dung hanh vi hien tai> }, 6 loai co so (min/max/length) co them { n: <so gioi han> }.
  VALIDATION_INVALID_EMAIL: 'VALIDATION_INVALID_EMAIL',
  VALIDATION_INVALID_STRING: 'VALIDATION_INVALID_STRING',
  VALIDATION_REQUIRED: 'VALIDATION_REQUIRED',
  VALIDATION_INVALID_UUID: 'VALIDATION_INVALID_UUID',
  VALIDATION_INVALID_ARRAY: 'VALIDATION_INVALID_ARRAY',
  VALIDATION_INVALID_INT: 'VALIDATION_INVALID_INT',
  VALIDATION_INVALID_NUMBER: 'VALIDATION_INVALID_NUMBER',
  VALIDATION_INVALID_BOOLEAN: 'VALIDATION_INVALID_BOOLEAN',
  VALIDATION_INVALID_ENUM: 'VALIDATION_INVALID_ENUM',
  VALIDATION_INVALID_OPTION: 'VALIDATION_INVALID_OPTION',
  VALIDATION_INVALID_DATE: 'VALIDATION_INVALID_DATE',
  VALIDATION_ARRAY_REQUIRED: 'VALIDATION_ARRAY_REQUIRED',
  VALIDATION_MIN_LENGTH: 'VALIDATION_MIN_LENGTH',
  VALIDATION_MAX_LENGTH: 'VALIDATION_MAX_LENGTH',
  VALIDATION_MIN_VALUE: 'VALIDATION_MIN_VALUE',
  VALIDATION_MAX_VALUE: 'VALIDATION_MAX_VALUE',
  VALIDATION_ARRAY_MIN_SIZE: 'VALIDATION_ARRAY_MIN_SIZE',
  VALIDATION_ARRAY_MAX_SIZE: 'VALIDATION_ARRAY_MAX_SIZE',
  /** Fallback cho constraint-key chua duoc liet ke (xem buildMessageForConstraint). */
  VALIDATION_INVALID: 'VALIDATION_INVALID',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
