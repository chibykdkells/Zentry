import type { LucideIcon } from 'lucide-react';
import {
  BadgeHelp,
  BookOpenText,
  CreditCard,
  Fingerprint,
  GraduationCap,
  RadioTower,
  Tv,
  Zap,
} from 'lucide-react';
export interface CatalogCategoryMeta {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: 'navy' | 'amber' | 'slate';
}

export const catalogCategoriesMeta: CatalogCategoryMeta[] = [
  {
    slug: 'jamb',
    title: 'JAMB',
    description: 'Admission letters, result printing, and profile recovery.',
    icon: GraduationCap,
    tone: 'navy',
  },
  {
    slug: 'nimc',
    title: 'NIN Services',
    description: 'Slip printing, validation, and data correction support.',
    icon: Fingerprint,
    tone: 'slate',
  },
  {
    slug: 'neco',
    title: 'NECO',
    description: 'Verification and exam-related support services.',
    icon: BookOpenText,
    tone: 'slate',
  },
  {
    slug: 'vtu-airtime',
    title: 'Airtime',
    description: 'Everyday airtime top-ups for major networks.',
    icon: RadioTower,
    tone: 'amber',
  },
  {
    slug: 'vtu-data',
    title: 'Data',
    description: 'Quick data bundle purchases across networks.',
    icon: Zap,
    tone: 'amber',
  },
  {
    slug: 'vtu-cable',
    title: 'Cable TV',
    description: 'Subscription payments for DStv, GOtv, and StarTimes.',
    icon: Tv,
    tone: 'slate',
  },
  {
    slug: 'vtu-electricity',
    title: 'Electricity',
    description: 'Prepaid meter and electricity bill support.',
    icon: CreditCard,
    tone: 'slate',
  },
];

export const catalogHighlights = [
  'Open to individuals, tenant-run business portals, and approved CBT operators',
  'Service requests are tracked from submission to completion',
  'Wallet, funds-on-hold, and fulfillment flow into later phases without redesign',
  'Daily-use services like airtime, data, NIN, and JAMB live under one workspace',
];

export const ordersLifecycle = [
  {
    title: 'Submit a request',
    description:
      'Choose a service, complete the required details, and confirm the request from a guided flow.',
  },
  {
    title: 'Track fulfillment',
    description:
      'Follow your request from submission through review, assignment, and completion.',
  },
  {
    title: 'Resolve outcomes',
    description:
      'Completed work, held-fund handling, and any disputes become visible from the orders workspace.',
  },
];

export const ordersEmptyFilters = [
  { id: 'all', label: 'All orders', count: 0 },
  { id: 'active', label: 'Active', count: 0 },
  { id: 'completed', label: 'Completed', count: 0 },
  { id: 'issues', label: 'Issues', count: 0 },
] as const;

export const emptyOrderReasons = [
  {
    title: 'No orders yet',
    description:
      'You have not submitted any service requests from this account yet.',
    icon: BadgeHelp,
  },
  {
    title: 'Status tracking is ready',
    description:
      'When requests start flowing, this page will organize them by progress and outcome.',
    icon: BookOpenText,
  },
];
