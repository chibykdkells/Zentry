import {
  TENANT_ADMIN_PERMISSIONS,
  type TenantAdminPermission,
  type UserRole,
} from '@zendocx/types';

type TenantAdminLikeUser = {
  role?: UserRole | null;
  adminPermissions?: TenantAdminPermission[];
} | null;

export const tenantAdminPermissionLabels: Record<
  TenantAdminPermission,
  {
    label: string;
    description: string;
  }
> = {
  MANAGE_BUSINESS_ADMINS: {
    label: 'Business admins',
    description:
      'Create, update, and remove other business admin accounts.',
  },
  MANAGE_BUSINESS_SETTINGS: {
    label: 'Business settings',
    description:
      'Update branding, homepage, logo, domain, and general business settings.',
  },
  MANAGE_USERS: {
    label: 'Customer users',
    description:
      'View customers and manage customer-role changes inside this business.',
  },
  MANAGE_CBT_CENTERS: {
    label: 'CBT centers',
    description:
      'Review CBT center records and approval decisions for this business.',
  },
  MANAGE_SERVICES: {
    label: 'Service catalog',
    description:
      'Control which services this business shows and how the catalog is shaped.',
  },
  MANAGE_SERVICE_CONNECTIONS: {
    label: 'API connections',
    description:
      'Update business-owned API routing and automated service connection settings.',
  },
  MANAGE_WALLET: {
    label: 'Wallet and payouts',
    description:
      'Operate the business wallet, review balances, and request withdrawals.',
  },
};

export function getEffectiveTenantAdminPermissions(
  user: TenantAdminLikeUser,
): TenantAdminPermission[] {
  if (user?.role !== 'TENANT_ADMIN') {
    return [];
  }

  return user.adminPermissions?.length
    ? user.adminPermissions
    : [...TENANT_ADMIN_PERMISSIONS];
}

export function hasTenantAdminPermission(
  user: TenantAdminLikeUser,
  permission: TenantAdminPermission,
): boolean {
  return getEffectiveTenantAdminPermissions(user).includes(permission);
}
