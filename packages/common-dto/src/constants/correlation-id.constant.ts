// 22/08/2026: bo sung ma dinh danh xuyen suot request (correlation ID) - Gateway gan gia tri nay
// cho MOI request (xem apps/gateway/src/proxy/correlation-id.middleware.ts) va forward sang
// downstream qua header, cac service phia sau chi can doc lai tu req.headers, khong can middleware
// rieng. AllExceptionsFilter (@app/common-guard) tu dong ghi gia tri nay vao log loi + tra ve
// trong body loi (field CONG THEM, optional - khong doi hanh vi loi cu) de tra cuu 1 request bi
// loi xuyen qua nhieu service KHONG con phai doi chieu thu cong theo timestamp.
export const CORRELATION_ID_HEADER = 'x-correlation-id';
