import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Briefcase,
  ClipboardList,
  HelpCircle,
  Home,
  LayoutDashboard,
  LineChart,
  MessageSquareWarning,
  Settings,
  Shield,
  User,
  Users,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-react';
import { UserRole } from '@zendocx/types';

export interface AppNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface RoleNavigation {
  primary: AppNavItem[];
  secondary: AppNavItem[];
}

export const individualPrimaryNav: AppNavItem[] = [
  { label: 'Home', href: '/home', icon: Home },
  { label: 'Services', href: '/services', icon: Zap },
  { label: 'My Orders', href: '/orders', icon: ClipboardList },
  { label: 'Wallet', href: '/wallet', icon: Wallet },
];

export const individualSecondaryNav: AppNavItem[] = [
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Security', href: '/security', icon: Shield },
  { label: 'Support', href: '/support', icon: HelpCircle },
];

export const cbtPrimaryNav: AppNavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Job Pool', href: '/job-pool', icon: Briefcase },
  { label: 'My Jobs', href: '/my-jobs', icon: ClipboardList },
  { label: 'Earnings', href: '/earnings', icon: LineChart },
  { label: 'Withdraw', href: '/withdraw', icon: Wallet },
  { label: 'Staff', href: '/staff', icon: Users },
];

// CBT_STAFF see the same routes except Staff management and Withdraw
export const cbtStaffPrimaryNav: AppNavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Job Pool', href: '/job-pool', icon: Briefcase },
  { label: 'My Jobs', href: '/my-jobs', icon: ClipboardList },
];

export const cbtSecondaryNav: AppNavItem[] = [
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Security', href: '/security', icon: Shield },
  { label: 'Support', href: '/support', icon: HelpCircle },
];

export const adminPrimaryNav: AppNavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Analytics', href: '/admin/analytics', icon: LineChart },
  { label: 'Services', href: '/admin/services', icon: Zap },
  { label: 'Orders', href: '/admin/orders', icon: ClipboardList },
  { label: 'Disputes', href: '/admin/disputes', icon: MessageSquareWarning },
  { label: 'CBT Centers', href: '/admin/cbt', icon: Users },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Finance', href: '/admin/finance', icon: Wallet },
  { label: 'System Config', href: '/admin/system-config', icon: Wrench },
];

export const adminSecondaryNav: AppNavItem[] = [
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Security', href: '/security', icon: Shield },
  { label: 'Support', href: '/support', icon: HelpCircle },
];

export const tenantPrimaryNav: AppNavItem[] = [
  { label: 'Dashboard', href: '/tenant/dashboard', icon: LayoutDashboard },
  { label: 'Customers', href: '/tenant/users', icon: Users },
  { label: 'Wallet', href: '/wallet', icon: Wallet },
  { label: 'CBT centers', href: '/tenant/cbt-management', icon: Users },
  { label: 'Services', href: '/tenant/services', icon: Zap },
  { label: 'API Integrations', href: '/tenant/providers', icon: Wrench },
  { label: 'Settings', href: '/tenant/settings', icon: Settings },
];

export const tenantSecondaryNav: AppNavItem[] = [
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Security', href: '/security', icon: Shield },
  { label: 'Support', href: '/support', icon: HelpCircle },
];

export function getNavigationForRole(
  role: UserRole | null | undefined,
): RoleNavigation {
  switch (role) {
    case UserRole.CBT_CENTER:
      return { primary: cbtPrimaryNav, secondary: cbtSecondaryNav };
    case UserRole.CBT_STAFF:
      return { primary: cbtStaffPrimaryNav, secondary: cbtSecondaryNav };
    case UserRole.SUPER_ADMIN:
      return { primary: adminPrimaryNav, secondary: adminSecondaryNav };
    case UserRole.TENANT_ADMIN:
      return { primary: tenantPrimaryNav, secondary: tenantSecondaryNav };
    case UserRole.INDIVIDUAL:
    default:
      return { primary: individualPrimaryNav, secondary: individualSecondaryNav };
  }
}
