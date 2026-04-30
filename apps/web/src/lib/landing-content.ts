import { Building2, ShieldCheck, Smartphone, UserRoundCog, Wallet } from 'lucide-react';

export const landingAudienceCards = [
  {
    title: 'For platform owners',
    description:
      'Sign in to the ZenDocx control layer to create tenants, provision tenant admins, and oversee the shared platform.',
    href: '/platform/login',
    cta: 'Open owner login',
    icon: UserRoundCog,
  },
  {
    title: 'For tenant users',
    description:
      'Individuals, CBT centers, and tenant staff should use the branded tenant portal URL shared by their organization.',
    href: null,
    cta: 'Use your organization portal URL',
    icon: Building2,
  },
] as const;

export const landingFeatureCards = [
  {
    title: 'Trusted service flow',
    description:
      'Move from account access to request submission and fulfillment in one clear workflow.',
    icon: ShieldCheck,
  },
  {
    title: 'Wallet-ready platform',
    description:
      'A single account structure for orders, payments, and the wallet features coming next.',
    icon: Wallet,
  },
  {
    title: 'Built for mobile use',
    description:
      'A responsive workspace designed for fast access on phones without losing desktop clarity.',
    icon: Smartphone,
  },
] as const;

export const landingServiceAreas = [
  'NIN support',
  'JAMB and exam services',
  'Airtime and data',
  'CBT center fulfillment',
  'Wallet-based payments',
] as const;
