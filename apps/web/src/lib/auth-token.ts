import { UserRole } from '@zentry/types';

interface JwtPayload {
  role?: string;
  exp?: number;
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded =
      normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

    if (typeof window === 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8');
    }

    return atob(padded);
  } catch {
    return null;
  }
}

export function getRoleFromJwt(token?: string): UserRole | null {
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  const payloadText = decodeBase64Url(parts[1]);
  if (!payloadText) {
    return null;
  }

  try {
    const payload = JSON.parse(payloadText) as JwtPayload;
    const role = payload.role;
    const exp = payload.exp;

    if (typeof exp === 'number' && exp * 1000 <= Date.now()) {
      return null;
    }

    if (
      role === UserRole.INDIVIDUAL ||
      role === UserRole.CBT_CENTER ||
      role === UserRole.TENANT_ADMIN ||
      role === UserRole.SUPER_ADMIN
    ) {
      return role;
    }

    return null;
  } catch {
    return null;
  }
}
