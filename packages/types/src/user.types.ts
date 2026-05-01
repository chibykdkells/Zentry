import { UserRole, CbtApprovalStatus } from './enums';

export const TENANT_ADMIN_PERMISSIONS = [
  'MANAGE_BUSINESS_ADMINS',
  'MANAGE_BUSINESS_SETTINGS',
  'MANAGE_USERS',
  'MANAGE_CBT_CENTERS',
  'MANAGE_SERVICES',
  'MANAGE_SERVICE_CONNECTIONS',
  'MANAGE_WALLET',
] as const;

export type TenantAdminPermission =
  (typeof TENANT_ADMIN_PERMISSIONS)[number];

export const TENANT_HOMEPAGE_TEMPLATES = [
  'spotlight',
  'service-grid',
  'guided-flow',
] as const;

export type TenantHomepageTemplate =
  (typeof TENANT_HOMEPAGE_TEMPLATES)[number];

export interface TenantHomepageStep {
  title: string;
  description: string;
}

export interface JwtUser {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  iat: number;
  exp: number;
}

export interface TenantPublic {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  textColor: string;
  buttonColor: string;
  fontStyle: string;
  customDomain: string | null;
  homepageTemplate: TenantHomepageTemplate;
  homepageHeading: string | null;
  homepageSubheading: string | null;
  homepageAbout: string | null;
  homepageManualSteps: TenantHomepageStep[];
}

export interface UserPublic {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  adminPermissions?: TenantAdminPermission[];
}

export interface CbtProfilePublic {
  id: string;
  centerName: string;
  licenseNumber: string;
  address: string;
  state: string;
  lga: string;
  approvalStatus: CbtApprovalStatus;
  approvedAt: string | null;
  isOnline: boolean;
}

export interface WalletPublic {
  id: string;
  availableBalance: string; // formatted Naira string e.g. "₦1,500.00"
  escrowBalance: string;
  totalEarned: string;
  totalWithdrawn: string;
}
