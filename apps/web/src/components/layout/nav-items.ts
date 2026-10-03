import { BarChartIcon, BriefcaseIcon, CalendarIcon, ClockIcon, FileTextIcon, FolderKanbanIcon, GridIcon, HomeIcon, MessageIcon, ShieldIcon } from '@/components/ui/Icons';
import type { IconProps } from '@/components/ui/Icons';
import { PERMISSIONS } from '@/constants/permissions';

export interface NavItem {
  to: string;
  /** 20/08/2026: doi tu chuoi tieng Viet tinh sang key i18next (rollout i18n) - Sidebar.tsx/
   *  Topbar.tsx goi t(labelKey) de lay nhan dung ngon ngu dang chon. Xem
   *  i18n/locales/{vi,en,ja}/common.json, muc "nav". */
  labelKey: string;
  icon: (props: IconProps) => JSX.Element;
  /** Chi hien thi voi nguoi dung co quyen vao khu vuc Quan tri (xem lib/utils.ts:canAccessAdminArea). */
  adminOnly?: boolean;
  /** 17/09/2026: chi hien thi voi nguoi dung co dung permission nay (khac adminOnly - kiem tra 1
   *  permission cu the thay vi ca nhom quyen quan tri). Dung cho "Bao cao & Phan tich": Employee
   *  KHONG co ANALYTICS_VIEW (xem DEFAULT_ROLE_PERMISSIONS.EMPLOYEE, permission.enum.ts) - truoc
   *  ban sua nay, Sidebar van hien link cho Employee du moi lenh goi API cua trang deu bi 403
   *  (AnalyticsController da @RequirePermissions(ANALYTICS_VIEW) tu truoc), khien trang vo dung. */
  requiredPermission?: string;
  /** 03/10/2026: cac tien to duong dan thuoc cung 1 nhom dieu huong voi item nay (vd "Trang chủ" gop
   *  chung Dashboard/Du an/Tai lieu/Khach hang phia sau 1 icon duy nhat tren rail chinh) - dung de
   *  xac dinh active (Sidebar.tsx) VA de AppShell.tsx quyet dinh khi nao hien SecondarySidebar.tsx.
   *  Khong co nghia la route moi, chi la cach gop ve mat dieu huong tren cac route DA CO SAN. */
  matchPrefixes?: string[];
}

/** 03/10/2026: 4 route duoc gop chung sau icon "Trang chủ" (xem NavItem.matchPrefixes o tren va
 *  SecondarySidebar.tsx - panel liet ke lai chinh 4 route nay khi dang o trong nhom). */
export const HOME_ROUTE_PREFIXES = ['/dashboard', '/projects', '/documents', '/customers'];

// Wireframe.md muc 2: Dashboard, Du an & Cong viec, Tai lieu, Thong bao, Bao cao & Phan tich, Quan tri.
// 03/10/2026: tai cau truc - "Trang chủ" gop chung Dashboard/Du an & Cong viec/Tai lieu/Khach hang
// phia sau 1 icon duy nhat (xem HOME_ROUTE_PREFIXES, SecondarySidebar.tsx); bo muc "Thong bao" rieng
// (gop het vao dropdown chuong tren Topbar, xem NotificationBell.tsx - khong con trang rieng).
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', labelKey: 'common:nav.home', icon: HomeIcon, matchPrefixes: HOME_ROUTE_PREFIXES },
  // 05/08/2026: HRM-lite (Technical_Spec.md muc 17) - cham cong (photo-proof) + nghi phep.
  { to: '/attendance', labelKey: 'common:nav.attendance', icon: ClockIcon },
  { to: '/leave-requests', labelKey: 'common:nav.leaveRequests', icon: CalendarIcon },
  // 28/09/2026: Messaging Service (nhan tin noi bo 1:1 va nhom/kenh) - khong requiredPermission vi
  // MESSAGE_VIEW/MESSAGE_SEND duoc cap cho ca 3 vai tro (Org Admin/Manager/Employee), gate DUY
  // NHAT boi dang nhap. Badge so tin nhan chua doc duoc Sidebar.tsx tu ve rieng (useUnreadMessagesCount).
  { to: '/messages', labelKey: 'common:nav.messages', icon: MessageIcon },
  { to: '/analytics', labelKey: 'common:nav.analytics', icon: BarChartIcon, requiredPermission: PERMISSIONS.ANALYTICS_VIEW },
  { to: '/admin/members', labelKey: 'common:nav.admin', icon: ShieldIcon, adminOnly: true },
];

/** 03/10/2026: danh sach hien thi tren SecondarySidebar.tsx khi dang o trong nhom "Trang chủ" (xem
 *  HOME_ROUTE_PREFIXES) - KHONG phai route moi, chi la cach trinh bay lai 4 route da co san tren. */
export const HOME_SUB_NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', labelKey: 'common:nav.homeNav.overview', icon: GridIcon },
  { to: '/projects', labelKey: 'common:nav.homeNav.projects', icon: FolderKanbanIcon },
  { to: '/documents', labelKey: 'common:nav.homeNav.documents', icon: FileTextIcon },
  // 04/08/2026: CRM-lite (Technical_Spec.md muc 16) - khach hang + pipeline ban hang.
  { to: '/customers', labelKey: 'common:nav.homeNav.customers', icon: BriefcaseIcon },
];
