import { ReactNode } from 'react';
import { CalendarIcon, DollarSignIcon, CheckSquareIcon, FileTextIcon, BellIcon } from '@/components/ui/Icons';
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

  const uuidInParenRegex = /\((?:mã[^:]*:\s*)?([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\)/gi;
  let cleaned = message.replace(uuidInParenRegex, '(#$1)'.toUpperCase());

  const bareUuidRegex = /\b([0-9a-f]{6})[0-9a-f]{2}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
  cleaned = cleaned.replace(bareUuidRegex, '#$1'.toUpperCase());

  return cleaned;
}

/**
 * Định dạng tiêu đề thông báo theo đa ngôn ngữ dựa trên type hoặc nội dung gốc:
 */
export function formatNotificationTitle(notification: AppNotification, t?: (key: string) => string): string {
  if (!t) return notification.title || '';

  const type = notification.type?.toLowerCase() || '';
  const rawTitle = (notification.title || '').trim().toLowerCase();

  // 1. Nghỉ phép đã duyệt
  if (
    type === 'leave_request.approved' ||
    rawTitle.includes('yêu cầu nghỉ phép đã được duyệt') ||
    rawTitle.includes('leave request approved')
  ) {
    return t('notifications:page.titles.leaveApproved');
  }

  // 2. Nghỉ phép bị từ chối
  if (
    type === 'leave_request.rejected' ||
    rawTitle.includes('yêu cầu nghỉ phép đã bị từ chối') ||
    rawTitle.includes('leave request rejected')
  ) {
    return t('notifications:page.titles.leaveRejected');
  }

  // 3. Deal chốt thành công
  if (
    type === 'deal.stage_changed' ||
    rawTitle.includes('deal đã chốt thành công') ||
    rawTitle.includes('deal successfully closed')
  ) {
    return t('notifications:page.titles.dealWon');
  }

  // 4. Giao công việc mới
  if (
    type === 'task.assigned' ||
    rawTitle.includes('bạn được giao công việc mới') ||
    rawTitle.includes('assigned a new task')
  ) {
    return t('notifications:page.titles.taskAssigned');
  }

  // 5. Tài liệu được chia sẻ
  if (
    type === 'document.shared' ||
    rawTitle.includes('tài liệu đã được chia sẻ') ||
    rawTitle.includes('document has been shared')
  ) {
    return t('notifications:page.titles.documentShared');
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

  // 1. Nghiệp vụ Nghỉ phép - TỪ CHỐI (Màu đỏ hồng - Rose)
  if (
    type.includes('leave_request.rejected') ||
    (type.includes('leave') && (title.includes('từ chối') || message.includes('từ chối') || title.includes('reject')))
  ) {
    return {
      icon: <CalendarIcon className="h-4 w-4" />,
      bgColor: 'bg-rose-100 text-rose-700 ring-1 ring-rose-600/20',
      textColor: 'text-rose-700',
      linkUrl: '/leave-requests',
      targetName: t ? t('notifications:page.targets.leave_request') : 'Nghỉ phép',
      targetKey: 'leave_request',
    };
  }

  // 2. Nghiệp vụ Nghỉ phép - ĐÃ DUYỆT / PHÊ DUYỆT (Màu xanh lá - Emerald)
  if (
    type.includes('leave_request.approved') ||
    (type.includes('leave') && (title.includes('duyệt') || message.includes('duyệt') || title.includes('phê duyệt') || title.includes('approv')))
  ) {
    return {
      icon: <CalendarIcon className="h-4 w-4" />,
      bgColor: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-600/20',
      textColor: 'text-emerald-700',
      linkUrl: '/leave-requests',
      targetName: t ? t('notifications:page.targets.leave_request') : 'Nghỉ phép',
      targetKey: 'leave_request',
    };
  }

  // 3. Nghiệp vụ Nghỉ phép chung (Màu cam nhạt - Amber)
  if (type.includes('leave') || title.includes('nghỉ phép') || message.includes('nghỉ phép')) {
    return {
      icon: <CalendarIcon className="h-4 w-4" />,
      bgColor: 'bg-amber-100 text-amber-700 ring-1 ring-amber-600/20',
      textColor: 'text-amber-700',
      linkUrl: '/leave-requests',
      targetName: t ? t('notifications:page.targets.leave_request') : 'Nghỉ phép',
      targetKey: 'leave_request',
    };
  }

  // 4. Cơ hội bán hàng (Deal / CRM) - MÀU TÍM CHỦ ĐẠO (Indigo)
  if (type.includes('deal') || title.includes('deal') || message.includes('deal') || title.includes('bán hàng')) {
    const customerId = payload.customerId as string | undefined;
    return {
      icon: <DollarSignIcon className="h-4 w-4" />,
      bgColor: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-600/20',
      textColor: 'text-indigo-700',
      linkUrl: customerId ? `/customers/${customerId}` : '/customers',
      targetName: t ? t('notifications:page.targets.deal') : 'Bán hàng (Deal)',
      targetKey: 'deal',
    };
  }

  // 5. Nghiệp vụ Công việc (Task) - Màu xanh da trời (Sky)
  if (type.includes('task') || title.includes('công việc') || message.includes('công việc')) {
    const projectId = payload.projectId as string | undefined;
    return {
      icon: <CheckSquareIcon className="h-4 w-4" />,
      bgColor: 'bg-sky-100 text-sky-700 ring-1 ring-sky-600/20',
      textColor: 'text-sky-700',
      linkUrl: projectId ? `/projects/${projectId}` : '/projects',
      targetName: t ? t('notifications:page.targets.task') : 'Công việc',
      targetKey: 'task',
    };
  }

  // 6. Nghiệp vụ Tài liệu (Document) - Slate / Indigo
  if (type.includes('document') || title.includes('tài liệu') || message.includes('tài liệu')) {
    return {
      icon: <FileTextIcon className="h-4 w-4" />,
      bgColor: 'bg-slate-100 text-slate-700 ring-1 ring-slate-400/20',
      textColor: 'text-slate-700',
      linkUrl: '/documents',
      targetName: t ? t('notifications:page.targets.document') : 'Tài liệu',
      targetKey: 'document',
    };
  }

  // Mặc định (Hệ thống / Chung)
  return {
    icon: <BellIcon className="h-4 w-4" />,
    bgColor: 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20',
    textColor: 'text-slate-600',
    linkUrl: null,
    targetName: t ? t('notifications:page.targets.system') : 'Hệ thống',
    targetKey: 'system',
  };
}
