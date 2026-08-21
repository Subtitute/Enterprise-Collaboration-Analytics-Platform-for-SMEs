import { BarChartIcon, BriefcaseIcon, CalendarIcon, ClockIcon, FileTextIcon, FolderKanbanIcon, GridIcon, BellIcon, ShieldIcon } from '@/components/ui/Icons';
import type { IconProps } from '@/components/ui/Icons';

export interface NavItem {
  to: string;
  /** 20/08/2026: doi tu chuoi tieng Viet tinh sang key i18next (rollout i18n) - Sidebar.tsx/
   *  Topbar.tsx goi t(labelKey) de lay nhan dung ngon ngu dang chon. Xem
   *  i18n/locales/{vi,en,ja}/common.json, muc "nav". */
  labelKey: string;
  icon: (props: IconProps) => JSX.Element;
  /** Chi hien thi voi nguoi dung co vai tro dang quan tri (xem lib/utils.ts:hasAdminRole). */
  adminOnly?: boolean;
}

// Wireframe.md muc 2: Dashboard, Du an & Cong viec, Tai lieu, Thong bao, Bao cao & Phan tich, Quan tri.
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', labelKey: 'common:nav.dashboard', icon: GridIcon },
  { to: '/projects', labelKey: 'common:nav.projects', icon: FolderKanbanIcon },
  { to: '/documents', labelKey: 'common:nav.documents', icon: FileTextIcon },
  // 04/08/2026: CRM-lite (Technical_Spec.md muc 16) - khach hang + pipeline ban hang.
  { to: '/customers', labelKey: 'common:nav.customers', icon: BriefcaseIcon },
  // 05/08/2026: HRM-lite (Technical_Spec.md muc 17) - cham cong (photo-proof) + nghi phep.
  { to: '/attendance', labelKey: 'common:nav.attendance', icon: ClockIcon },
  { to: '/leave-requests', labelKey: 'common:nav.leaveRequests', icon: CalendarIcon },
  { to: '/notifications', labelKey: 'common:nav.notifications', icon: BellIcon },
  { to: '/analytics', labelKey: 'common:nav.analytics', icon: BarChartIcon },
  { to: '/admin/members', labelKey: 'common:nav.admin', icon: ShieldIcon, adminOnly: true },
];
