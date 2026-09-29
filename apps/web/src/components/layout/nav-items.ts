import { BarChartIcon, BriefcaseIcon, CalendarIcon, ClockIcon, FileTextIcon, FolderKanbanIcon, GridIcon, BellIcon, MessageIcon, ShieldIcon } from '@/components/ui/Icons';
import type { IconProps } from '@/components/ui/Icons';
import { PERMISSIONS } from '@/constants/permissions';

export type NavGroup = 'overview' | 'workspace' | 'hrm' | 'insights';

export interface NavItem {
  to: string;
  labelKey: string;
  icon: (props: IconProps) => JSX.Element;
  group: NavGroup;
  adminOnly?: boolean;
  requiredPermission?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', labelKey: 'common:nav.dashboard', icon: GridIcon, group: 'overview' },
  { to: '/projects', labelKey: 'common:nav.projects', icon: FolderKanbanIcon, group: 'workspace' },
  { to: '/documents', labelKey: 'common:nav.documents', icon: FileTextIcon, group: 'workspace' },
  // 04/08/2026: CRM-lite (Technical_Spec.md muc 16) - khach hang + pipeline ban hang.
  { to: '/customers', labelKey: 'common:nav.customers', icon: BriefcaseIcon, group: 'workspace' },
  // 05/08/2026: HRM-lite (Technical_Spec.md muc 17) - cham cong (photo-proof) + nghi phep.
  { to: '/attendance', labelKey: 'common:nav.attendance', icon: ClockIcon, group: 'hrm' },
  { to: '/leave-requests', labelKey: 'common:nav.leaveRequests', icon: CalendarIcon, group: 'hrm' },
  // 28/09/2026: Messaging Service (nhan tin noi bo 1:1 va nhom/kenh) - khong requiredPermission vi
  // MESSAGE_VIEW/MESSAGE_SEND duoc cap cho ca 3 vai tro (Org Admin/Manager/Employee), gate DUY
  // NHAT boi dang nhap. Badge so tin nhan chua doc duoc Sidebar.tsx tu ve rieng (useUnreadMessagesCount).
  { to: '/messages', labelKey: 'common:nav.messages', icon: MessageIcon, group: 'overview' },
  { to: '/notifications', labelKey: 'common:nav.notifications', icon: BellIcon, group: 'insights' },
  { to: '/analytics', labelKey: 'common:nav.analytics', icon: BarChartIcon, group: 'insights', requiredPermission: PERMISSIONS.ANALYTICS_VIEW },
  { to: '/admin/members', labelKey: 'common:nav.admin', icon: ShieldIcon, group: 'insights', adminOnly: true },
];
