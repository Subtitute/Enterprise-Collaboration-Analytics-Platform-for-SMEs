import { BarChartIcon, BriefcaseIcon, CalendarIcon, ClockIcon, FileTextIcon, FolderKanbanIcon, GridIcon, BellIcon, ShieldIcon } from '@/components/ui/Icons';
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
  { to: '/customers', labelKey: 'common:nav.customers', icon: BriefcaseIcon, group: 'workspace' },
  { to: '/attendance', labelKey: 'common:nav.attendance', icon: ClockIcon, group: 'hrm' },
  { to: '/leave-requests', labelKey: 'common:nav.leaveRequests', icon: CalendarIcon, group: 'hrm' },
  { to: '/notifications', labelKey: 'common:nav.notifications', icon: BellIcon, group: 'insights' },
  { to: '/analytics', labelKey: 'common:nav.analytics', icon: BarChartIcon, group: 'insights', requiredPermission: PERMISSIONS.ANALYTICS_VIEW },
  { to: '/admin/members', labelKey: 'common:nav.admin', icon: ShieldIcon, group: 'insights', adminOnly: true },
];
