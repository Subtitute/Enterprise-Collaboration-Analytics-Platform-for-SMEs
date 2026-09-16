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
  const uuidInParenRegex = /\((?:mã[^:]*:\s*)?([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\)/gi;
  let cleaned = message.replace(uuidInParenRegex, '(#$1)'.toUpperCase());

  const bareUuidRegex = /\b([0-9a-f]{6})[0-9a-f]{2}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
  cleaned = cleaned.replace(bareUuidRegex, '#$1'.toUpperCase());

  return cleaned;
}

/**
 * Lấy cấu hình thị giác hóa danh mục và màu sắc ngữ cảnh (Semantic Colors) theo kết quả sự kiện:
 * - Phê duyệt / Thành công: Màu xanh lá (emerald)
 * - Từ chối / Cảnh báo: Màu đỏ hồng (rose)
 * - Cơ hội bán hàng (Deal): Màu tím chủ đạo (indigo)
 * - Công việc (Task): Màu xanh da trời (sky)
 * - Tài liệu: Màu tím nhạt / slate
 */
export function getNotificationVisualConfig(notification: AppNotification): NotificationVisualConfig {
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
    (type.includes('leave') && (title.includes('từ chối') || message.includes('từ chối'))) // i18n-lint-ignore: khop text backend, khong phai chuoi UI
  ) {
    return {
      icon: <CalendarIcon className="h-4 w-4" />,
      bgColor: 'bg-rose-100 text-rose-700 ring-1 ring-rose-600/20',
      textColor: 'text-rose-700',
      linkUrl: '/leave-requests',
      targetName: t('notifications:visual.leave'),
    };
  }

  // 2. Nghiệp vụ Nghỉ phép - ĐÃ DUYỆT / PHÊ DUYỆT (Màu xanh lá - Emerald)
  if (
    type.includes('leave_request.approved') ||
    (type.includes('leave') && (title.includes('duyệt') || message.includes('duyệt') || title.includes('phê duyệt'))) // i18n-lint-ignore: khop text backend, khong phai chuoi UI
  ) {
    return {
      icon: <CalendarIcon className="h-4 w-4" />,
      bgColor: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/20',
      textColor: 'text-emerald-700',
      linkUrl: '/leave-requests',
      targetName: t('notifications:visual.leave'),
    };
  }

  // 3. Nghiệp vụ Nghỉ phép chung (Màu cam nhạt - Amber)
  if (type.includes('leave') || title.includes('nghỉ phép') || message.includes('nghỉ phép')) { // i18n-lint-ignore: khop text backend, khong phai chuoi UI
    return {
      icon: <CalendarIcon className="h-4 w-4" />,
      bgColor: 'bg-amber-100 text-amber-700 ring-1 ring-amber-600/20',
      textColor: 'text-amber-700',
      linkUrl: '/leave-requests',
      targetName: t('notifications:visual.leave'),
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
      targetName: t('notifications:visual.dealSales'),
    };
  }

  // 5. Nghiệp vụ Công việc (Task) - Màu xanh da trời (Sky)
  if (type.includes('task') || title.includes('công việc') || message.includes('công việc')) { // i18n-lint-ignore: khop text backend, khong phai chuoi UI
    const projectId = payload.projectId as string | undefined;
    return {
      icon: <CheckSquareIcon className="h-4 w-4" />,
      bgColor: 'bg-sky-100 text-sky-700 ring-1 ring-sky-600/20',
      textColor: 'text-sky-700',
      linkUrl: projectId ? `/projects/${projectId}` : '/projects',
      targetName: t('notifications:visual.task'),
    };
  }

  // 6. Nghiệp vụ Tài liệu (Document) - Slate / Indigo
  if (type.includes('document') || title.includes('tài liệu') || message.includes('tài liệu')) { // i18n-lint-ignore: khop text backend, khong phai chuoi UI
    return {
      icon: <FileTextIcon className="h-4 w-4" />,
      bgColor: 'bg-slate-100 text-slate-700 ring-1 ring-slate-400/20',
      textColor: 'text-slate-700',
      linkUrl: '/documents',
      targetName: t('notifications:visual.document'),
    };
  }

  // Mặc định (Hệ thống / Chung)
  return {
    icon: <BellIcon className="h-4 w-4" />,
    bgColor: 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20',
    textColor: 'text-slate-600',
    linkUrl: null,
    targetName: t('notifications:visual.system'),
  };
}
