import {
  BadgeHelp,
  BookOpen,
  LifeBuoy,
  MessageSquareWarning,
  ShieldAlert,
  WalletCards,
} from 'lucide-react';

export const supportQuickActions = [
  {
    title: 'Account access help',
    description:
      'Get guidance on login issues, password reset, email verification, and wallet PIN recovery.',
    href: '/security',
    cta: 'Open security',
    icon: ShieldAlert,
  },
  {
    title: 'Order and request help',
    description:
      'Review how requests will move through submission, fulfillment, and final delivery.',
    href: '/orders',
    cta: 'Open orders',
    icon: BadgeHelp,
  },
  {
    title: 'Wallet and balance help',
    description:
      'Understand wallet readiness, funds on hold, and what funding support will look like next.',
    href: '/wallet',
    cta: 'Open wallet',
    icon: WalletCards,
  },
];

export const supportFaqs = [
  {
    question: 'Who can use ZenDocx?',
    answer:
      'ZenDocx now supports individuals, approved CBT centers, and tenant-managed business portals. The public account flow is no longer limited to students.',
  },
  {
    question: 'What if I cannot sign in?',
    answer:
      'Start from password reset if you forgot your password, and use the security workspace to review account readiness and wallet PIN status.',
  },
  {
    question: 'When will live support tickets arrive?',
    answer:
      'This workspace is preparing for structured support and escalation flows without waiting for later backend ticket modules.',
  },
  {
    question: 'How will disputes be handled?',
    answer:
      'Disputes are tied to order outcomes and timing windows. The dispute workspace explains when a request becomes eligible and how resolution will be surfaced.',
  },
];

export const supportChannels = [
  {
    title: 'Self-service help',
    description:
      'Use the refined account, wallet, notifications, and orders workspaces to answer most common setup questions.',
    icon: BookOpen,
  },
  {
    title: 'Escalation guidance',
    description:
      'If an issue touches request delivery, wallet movement, or account access, the platform will route that into a support flow and dispute-aware handling.',
    icon: LifeBuoy,
  },
  {
    title: 'Dispute readiness',
    description:
      'For request-quality issues, the dispute workspace is where eligibility windows and next steps will be made clear.',
    icon: MessageSquareWarning,
  },
];

export const disputeReadiness = [
  {
    title: 'Disputes are tied to real orders',
    description:
      'You will raise a dispute from a request that has actually moved through fulfillment, not from a generic support form.',
  },
  {
    title: 'Timing matters',
    description:
      'Funds-on-hold and dispute windows are designed around delivery timing, so eligibility will be visible from the order lifecycle.',
  },
  {
    title: 'Support and disputes stay connected',
    description:
      'When a request needs human review, support context and dispute status should reinforce each other instead of living in separate silos.',
  },
];

export const disputeOutcomes = [
  {
    title: 'Awaiting eligible order activity',
    description:
      'Once a request reaches a stage where quality or fulfillment needs review, it will appear here with clear next actions.',
    icon: MessageSquareWarning,
  },
  {
    title: 'Review and resolution path',
    description:
      'Later slices will add structured status tracking for open disputes, review decisions, and final outcomes.',
    icon: ShieldAlert,
  },
];
