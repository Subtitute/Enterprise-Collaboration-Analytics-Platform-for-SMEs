import i18n from '@/i18n';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

const ROUTE_LABEL_KEYS: Record<string, string> = {
  dashboard: 'common:nav.homeNav.overview',
  projects: 'common:nav.homeNav.projects',
  documents: 'common:nav.homeNav.documents',
  customers: 'common:nav.homeNav.customers',
  attendance: 'common:nav.attendance',
  'leave-requests': 'common:nav.leaveRequests',
  messages: 'common:nav.messages',
  analytics: 'common:nav.analytics',
  admin: 'common:nav.admin',
  members: 'admin:members.title',
  departments: 'admin:departments.title',
  roles: 'admin:roles.title',
  'roles-permissions': 'admin:roles.title',
  'failed-events': 'admin:failedEvents.title',
  profile: 'profile:page.title',
  settings: 'common:topbar.settings',
};

const DEFAULT_ROUTE_FALLBACKS: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Dự án',
  documents: 'Tài liệu',
  customers: 'Khách hàng',
  attendance: 'Chấm công',
  'leave-requests': 'Nghỉ phép',
  messages: 'Nhắn tin',
  analytics: 'Báo cáo & Phân tích',
  admin: 'Quản trị',
  members: 'Thành viên',
  departments: 'Phòng ban',
  roles: 'Vai trò & Quyền',
  'roles-permissions': 'Vai trò & Phân quyền',
  'failed-events': 'Sự kiện lỗi hệ thống',
  profile: 'Hồ sơ cá nhân',
  settings: 'Cài đặt',
};

const HOME_GROUP_SEGMENTS = new Set(['dashboard', 'projects', 'documents', 'customers']);

function getLabel(seg: string): string {
  const i18nKey = ROUTE_LABEL_KEYS[seg];
  if (i18nKey && i18n.isInitialized) {
    const translated = i18n.t(i18nKey);
    if (translated && translated !== i18nKey) return translated;
  }
  return DEFAULT_ROUTE_FALLBACKS[seg] || seg;
}

/**
 * Tự động trích xuất breadcrumb từ pathname của React Router.
 * - Chỉ nhóm Trang chủ (Dashboard, Dự án, Tài liệu, Khách hàng) mới có tiền tố Dashboard / ...
 * - Các module độc lập (Chấm công, Nghỉ phép, Nhắn tin, Báo cáo & Phân tích, Quản trị...) hiển thị đúng tên module đó.
 */
export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const homeLabel = getLabel('dashboard');

  if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
    return [{ label: homeLabel }];
  }

  const isHomeGroup = HOME_GROUP_SEGMENTS.has(segments[0]);
  const items: BreadcrumbItem[] = [];

  if (isHomeGroup) {
    items.push({ label: homeLabel, href: '/dashboard' });
  }

  let currentPath = '';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentPath += `/${seg}`;

    // Nếu thuộc nhóm Trang chủ và segment là 'dashboard' thì bỏ qua vì đã có ở gốc
    if (isHomeGroup && seg === 'dashboard') continue;

    const isLast = i === segments.length - 1;
    let label = getLabel(seg);

    if (label === seg) {
      // Trường hợp ID động (UUID / CUID / MongoDB ObjectId)
      if (seg.length > 12) {
        label = i18n.isInitialized ? i18n.t('common:detail', 'Chi tiết') : 'Chi tiết';
      } else {
        label = decodeURIComponent(seg);
      }
    }

    items.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  }

  return items;
}
