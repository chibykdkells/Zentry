import { FileCheck2, ShieldCheck, Smartphone, UserRound, Wallet } from 'lucide-react';

export const landingAudienceCards = [
  {
    title: 'For individuals',
    description:
      'Open a personal account for identity support, exam services, and everyday airtime or data purchases.',
    href: '/register',
    cta: 'Create an account',
    icon: UserRound,
  },
  {
    title: 'For CBT centers',
    description:
      'Apply for approval, pick up fulfillment work, and manage earnings from a dedicated operations workspace.',
    href: '/register/cbt',
    cta: 'Apply as a CBT center',
    icon: FileCheck2,
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
