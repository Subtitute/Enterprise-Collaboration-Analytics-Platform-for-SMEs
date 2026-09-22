import { ReactNode } from 'react';
import { CalendarIcon, DollarSignIcon, CheckSquareIcon, FileTextIcon, BellIcon } from '@/components/ui/Icons';
import { t } from '@/i18n';
import type { AppNotification } from '@/types';

export interface NotificationVisualConfig {
  icon: ReactNode;
  bgColor: string;
  textColor: string;
  linkUrl: string | null;
  targetName: string;
  targetKey: 'leave_request' | 'deal' | 'task' | 'document' | 'system';
}

/**
 * Trích xuất mã định danh rút gọn (#hash) từ message hoặc payload:
 * VD: "...(mã yêu cầu: df084d72-dc27-48ce-8e2e-ef392666ef19)" -> "#DF084D"
 */
export function extractEntityHash(notification: AppNotification): string | null {
  const payload = notification.payload || {};
  const idCandidates = [
    payload.leaveRequestId,
    payload.dealId,
    payload.taskId,
    payload.fileId,
    payload.projectId,
  ];

  for (const cand of idCandidates) {
    if (typeof cand === 'string' && cand.length >= 6) {
      return `#${cand.slice(0, 6).toUpperCase()}`;
    }
  }

  // Nếu không có trong payload, tìm trong message
  const match = /([0-9a-f]{6,8})-[0-9a-f]{4}-[0-9a-f]{4}/i.exec(notification.message || '');
  if (match) {
    return `#${match[1].slice(0, 6).toUpperCase()}`;
  }

  return null;
}

/**
 * Làm sạch chuỗi message (giữ lại hỗ trợ cho các nơi khác nếu cần)
 */
export function cleanNotificationMessage(message: string): string {
  if (!message) return '';

  // 15/09/2026: dong duoi la regex literal, chu "ma" trong do la mot phan cua PATTERN khop chuoi
  // "(ma yeu cau: <uuid>)" that su nam trong message backend tra ve, khong phai chuoi UI hien thi -
  // khong dua qua t(). Script check-hardcoded-vietnamese van bat dong nay vi buoc "an" regex
  // literal cua no chi giu nguyen text de tranh nham thanh comment/string khac chu khong thuc su
  // loai bo ky tu co dau ben trong khoi luot quet. i18n-lint-ignore: regex pattern khop text backend, khong phai chuoi UI
  // 16/09/2026: '(#$1)'.toUpperCase() goc chi uppercase chuoi PATTERN truoc khi replace (khong co
  // tac dung vi $1 la backreference, chi duoc thay the SAU khi replace chay) nen hash tra ve bi sai,
  // van giu nguyen chu thuong - doi sang callback de uppercase dung phan hex vua khop.
  // 16/09/2026: marker i18n-lint-ignore o dong 54 cach day 4 dong nen script khong tinh la "dong
  // ngay truoc" dong regex ben duoi - them lai truc tiep tren dong nay de script nhan dung: pattern
  // "mã" trong regex la khop chuoi that su tu backend, khong phai chuoi UI - i18n-lint-ignore
  const uuidInParenRegex = /\((?:mã[^:]*:\s*)?([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\)/gi;
  let cleaned = message.replace(uuidInParenRegex, (_m: string, hex: string) => `(#${hex.toUpperCase()})`);

  const bareUuidRegex = /\b([0-9a-f]{6})[0-9a-f]{2}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
  cleaned = cleaned.replace(bareUuidRegex, (_m: string, hex: string) => `#${hex.toUpperCase()}`);

  return cleaned;
}

/**
 * Định dạng tiêu đề thông báo theo đa ngôn ngữ dựa trên type hoặc nội dung gốc:
 */
export function formatNotificationTitle(notification: AppNotification, t?: (key: string) => string): string {
  if (!t) return notification.title || '';

  const type = notification.type?.toLowerCase() || '';
  const rawTitle = (notification.title || '').trim().toLowerCase();

  // 16/09/2026: cac chuoi tieng Viet trong rawTitle.includes(...) ben duoi (ca 5 khoi if phia
  // duoi) la HANG SO de doi chieu voi title thong bao - title do BACKEND sinh san (tieng Viet) va
  // luu vao MongoDB tai thoi diem phat sinh event, khong phai chuoi UI tinh nen khong dua qua t();
  // day chi la fallback nhan dien khi truong `type` cua notification khong khop/thieu. Ly do giong
  // het khoi giai thich chi tiet hon trong getNotificationVisualConfig ben duoi ham nay.
  // 1. Nghỉ phép đã duyệt
  if (
    type === 'leave_request.approved' ||
    rawTitle.includes('yêu cầu nghỉ phép đã được duyệt') || // i18n-lint-ignore: khop title backend, khong phai chuoi UI
    rawTitle.includes('leave request approved')
  ) {
    return t('notifications:page.titles.leaveApproved');
  }

  // 2. Nghỉ phép bị từ chối
  if (
    type === 'leave_request.rejected' ||
    rawTitle.includes('yêu cầu nghỉ phép đã bị từ chối') || // i18n-lint-ignore: khop title backend, khong phai chuoi UI
    rawTitle.includes('leave request rejected')
  ) {
    return t('notifications:page.titles.leaveRejected');
  }

  // 3. Deal chốt thành công
  if (
    type === 'deal.stage_changed' ||
    rawTitle.includes('deal đã chốt thành công') || // i18n-lint-ignore: khop title backend, khong phai chuoi UI
    rawTitle.includes('deal successfully closed')
  ) {
    return t('notifications:page.titles.dealWon');
  }

  // 4. Giao công việc mới
  if (
    type === 'task.assigned' ||
    rawTitle.includes('bạn được giao công việc mới') || // i18n-lint-ignore: khop title backend, khong phai chuoi UI
    rawTitle.includes('assigned a new task')
  ) {
    return t('notifications:page.titles.taskAssigned');
  }

  // 4b. Công việc đã hoàn thành (Task Done -> Notify Manager)
  if (
    type === 'task.completed' ||
    type === 'task_completed' ||
    rawTitle.includes('công việc đã hoàn thành') || // i18n-lint-ignore: khop title backend, khong phai chuoi UI
    rawTitle.includes('task has been completed') ||
    rawTitle.includes('task completed')
  ) {
    return t('notifications:page.titles.taskCompleted');
  }

  // 5. Tài liệu được chia sẻ
  if (
    type === 'document.shared' ||
    rawTitle.includes('tài liệu đã được chia sẻ') || // i18n-lint-ignore: khop title backend, khong phai chuoi UI
    rawTitle.includes('document has been shared')
  ) {
    return t('notifications:page.titles.documentShared');
  }

  // 6. Công bố ngày nghỉ lễ công ty (bổ sung 17/09/2026 - thông báo toàn tổ chức)
  if (
    type === 'calendar_event.created' ||
    rawTitle.includes('thông báo ngày nghỉ lễ') // i18n-lint-ignore: khop title backend, khong phai chuoi UI
  ) {
    return t('notifications:page.titles.holidayAnnounced');
  }

  return notification.title || '';
}

/**
 * Lấy cấu hình thị giác hóa danh mục và màu sắc ngữ cảnh (Semantic Colors) theo kết quả sự kiện:
 * - Phê duyệt / Thành công: Màu xanh lá (emerald)
 * - Từ chối / Cảnh báo: Màu đỏ hồng (rose)
 * - Cơ hội bán hàng (Deal): Màu tím chủ đạo (indigo)
 * - Công việc (Task): Màu xanh da trời (sky)
 * - Tài liệu: Màu tím nhạt / slate
 */
export function getNotificationVisualConfig(notification: AppNotification, t?: (key: string) => string): NotificationVisualConfig {
  const type = notification.type?.toLowerCase() || '';
  const title = notification.title?.toLowerCase() || '';
  const message = notification.message?.toLowerCase() || '';
  const payload = notification.payload || {};

  // 15/09/2026: cac chuoi tieng Viet trong .includes(...) ben duoi (vd 'tu choi', 'duyet', 'nghi
  // phep'...) la HANG SO de doi chieu voi title/message backend tra ve - khong phai chuoi hien
  // thi cho nguoi dung nen KHONG dua qua t(): backend hien tai luon sinh title/message bang tieng
  // Viet bat ke ngon ngu UI nguoi dung dang chon, nen doi chieu phai giu nguyen van tieng Viet moi
  // dung. Neu boc qua t(), ket qua se doi theo ngon ngu UI (vd tra ve "rejected" khi UI la tieng
  // Anh) va so khop SAI hoan toan voi message tieng Viet tu backend - gay loi phan loai notification
  // cho user dang dung UI Anh/Nhat. Day la han che co san (backend chua i18n hoa noi dung
  // notification), khong sua trong lan cap nhat i18n frontend nay - moi dong .includes(...) co dau
  // duoi day duoc danh dau i18n-lint-ignore vi ly do tren.
  // 1. Nghiệp vụ Nghỉ phép - TỪ CHỐI (Màu đỏ hồng - Rose)
  if (
    type.includes('leave_request.rejected') ||
    (type.includes('leave') && (title.includes('từ chối') || message.includes('từ chối') || title.includes('reject'))) // i18n-lint-ignore: khop text backend, khong phai chuoi UI
  ) {
    return {
      icon: <CalendarIcon className="h-4 w-4" />,
      bgColor: 'bg-rose-100 text-rose-700 ring-1 ring-rose-600/20',
      textColor: 'text-rose-700',
      linkUrl: '/leave-requests',
      // 16/09/2026: 'targetName: t ? t(key) : "fallback"' o day va cac targetName tuong tu ben
      // duoi la gia tri du phong CHU DICH mirror dung noi dung cua key i18n that (dung khi ham
      // duoc goi ma khong co `t`, vd tu noi khong co i18n context) - khong phai chuoi UI hien thi
      // song song voi ket qua t(), nen khong tinh la hardcode con sot. Cung mau voi
      // getRoleBadgeConfig trong MembersPage.tsx.
      targetName: t ? t('notifications:page.targets.leave_request') : 'Nghỉ phép', // i18n-lint-ignore: fallback mirror dung key i18n that
      targetKey: 'leave_request',
    };
  }

  // 2. Nghiệp vụ Nghỉ phép - ĐÃ DUYỆT / PHÊ DUYỆT (Màu xanh lá - Emerald)
  if (
    type.includes('leave_request.approved') ||
    (type.includes('leave') && (title.includes('duyệt') || message.includes('duyệt') || title.includes('phê duyệt') || title.includes('approv'))) // i18n-lint-ignore: khop text backend, khong phai chuoi UI
  ) {
    return {
      icon: <CalendarIcon className="h-4 w-4" />,
      bgColor: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/20',
      textColor: 'text-emerald-700',
      linkUrl: '/leave-requests',
      targetName: t ? t('notifications:page.targets.leave_request') : 'Nghỉ phép', // i18n-lint-ignore: fallback mirror dung key i18n that
      targetKey: 'leave_request',
    };
  }

  // 3. Nghiệp vụ Nghỉ phép chung (Màu cam nhạt - Amber)
  if (type.includes('leave') || title.includes('nghỉ phép') || message.includes('nghỉ phép')) { // i18n-lint-ignore: khop text backend, khong phai chuoi UI
    return {
      icon: <CalendarIcon className="h-4 w-4" />,
      bgColor: 'bg-amber-100 text-amber-700 ring-1 ring-amber-600/20',
      textColor: 'text-amber-700',
      linkUrl: '/leave-requests',
      targetName: t ? t('notifications:page.targets.leave_request') : 'Nghỉ phép', // i18n-lint-ignore: fallback mirror dung key i18n that
      targetKey: 'leave_request',
    };
  }

  // 4. Cơ hội bán hàng (Deal / CRM) - MÀU TÍM CHỦ ĐẠO (Indigo)
  if (type.includes('deal') || title.includes('deal') || message.includes('deal') || title.includes('bán hàng')) { // i18n-lint-ignore: khop text backend, khong phai chuoi UI
    const customerId = payload.customerId as string | undefined;
    return {
      icon: <DollarSignIcon className="h-4 w-4" />,
      bgColor: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-600/20',
      textColor: 'text-indigo-700',
      linkUrl: customerId ? `/customers/${customerId}` : '/customers',
      targetName: t ? t('notifications:page.targets.deal') : 'Bán hàng (Deal)', // i18n-lint-ignore: fallback mirror dung key i18n that
      targetKey: 'deal',
    };
  }

  // 5. Nghiệp vụ Công việc (Task) - Màu xanh da trời (Sky) hoặc Xanh ngọc (Emerald) khi hoàn thành
  if (type.includes('task') || title.includes('công việc') || message.includes('công việc')) { // i18n-lint-ignore: khop text backend, khong phai chuoi UI
    const projectId = payload.projectId as string | undefined;
    const taskId = payload.taskId as string | undefined;
    const isCompleted = type.includes('completed') || title.includes('hoàn thành') || title.includes('completed'); // i18n-lint-ignore: khop text backend, khong phai chuoi UI

    let linkUrl: string | null = null;
    if (projectId) {
      linkUrl = taskId ? `/projects/${projectId}?taskId=${taskId}` : `/projects/${projectId}`;
    } else {
      linkUrl = '/projects';
    }

    return {
      icon: <CheckSquareIcon className="h-4 w-4" />,
      bgColor: isCompleted
        ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/20'
        : 'bg-sky-100 text-sky-700 ring-1 ring-sky-600/20',
      textColor: isCompleted ? 'text-emerald-700' : 'text-sky-700',
      linkUrl,
      targetName: t ? t('notifications:page.targets.task') : 'Công việc', // i18n-lint-ignore: fallback mirror dung key i18n that
      targetKey: 'task',
    };
  }

  // 6. Nghiệp vụ Tài liệu (Document) - Slate / Indigo
  if (type.includes('document') || title.includes('tài liệu') || message.includes('tài liệu')) { // i18n-lint-ignore: khop text backend, khong phai chuoi UI
    return {
      icon: <FileTextIcon className="h-4 w-4" />,
      bgColor: 'bg-slate-100 text-slate-700 ring-1 ring-slate-400/20',
      textColor: 'text-slate-700',
      linkUrl: '/documents',
      targetName: t ? t('notifications:page.targets.document') : 'Tài liệu', // i18n-lint-ignore: fallback mirror dung key i18n that
      targetKey: 'document',
    };
  }

  // 7. Công bố ngày nghỉ lễ công ty (bổ sung 17/09/2026) - Cam (Amber), mirror màu chấm HOLIDAY
  // trên Lịch công ty (CalendarPage.tsx). Vẫn thuộc targetKey 'system' (không mở rộng union type/
  // bộ lọc riêng ở NotificationsPage.tsx - thông báo này rơi vào nhánh lọc "Hệ thống" mặc định).
  if (type === 'calendar_event.created' || title.includes('thông báo ngày nghỉ lễ')) { // i18n-lint-ignore: khop text backend, khong phai chuoi UI
    return {
      icon: <CalendarIcon className="h-4 w-4" />,
      bgColor: 'bg-amber-100 text-amber-700 ring-1 ring-amber-600/20',
      textColor: 'text-amber-700',
      linkUrl: null,
      targetName: t ? t('notifications:page.targets.system') : 'Hệ thống', // i18n-lint-ignore: fallback mirror dung key i18n that
      targetKey: 'system',
    };
  }

  // Mặc định (Hệ thống / Chung)
  return {
    icon: <BellIcon className="h-4 w-4" />,
    bgColor: 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20',
    textColor: 'text-slate-600',
    linkUrl: null,
    targetName: t ? t('notifications:page.targets.system') : 'Hệ thống', // i18n-lint-ignore: fallback mirror dung key i18n that
    targetKey: 'system',
  };
}
