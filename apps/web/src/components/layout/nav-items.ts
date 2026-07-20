import { BarChartIcon, FileTextIcon, FolderKanbanIcon, GridIcon, BellIcon, ShieldIcon } from '@/components/ui/Icons';
import type { IconProps } from '@/components/ui/Icons';

export interface NavItem {
  to: string;
  label: string;
  icon: (props: IconProps) => JSX.Element;
  /** Chi hien thi voi nguoi dung co vai tro dang quan tri (xem lib/utils.ts:hasAdminRole). */
  adminOnly?: boolean;
}

// Wireframe.md muc 2: Dashboard, Du an & Cong viec, Tai lieu, Thong bao, Bao cao & Phan tich, Quan tri.
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: GridIcon },
  { to: '/projects', label: 'Dự án & Công việc', icon: FolderKanbanIcon },
  { to: '/documents', label: 'Tài liệu', icon: FileTextIcon },
  { to: '/notifications', label: 'Thông báo', icon: BellIcon },
  { to: '/analytics', label: 'Báo cáo & Phân tích', icon: BarChartIcon },
  { to: '/admin/members', label: 'Quản trị', icon: ShieldIcon, adminOnly: true },
];
