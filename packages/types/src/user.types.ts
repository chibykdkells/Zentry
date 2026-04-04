import { UserRole, CbtApprovalStatus } from './enums';

export interface JwtUser {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
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
