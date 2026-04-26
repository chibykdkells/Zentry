import type { LucideIcon } from 'lucide-react';
import {
  ClipboardList,
  LineChart,
  Layers3,
  MessageSquareWarning,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';

export interface AdminPanelItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const adminDashboardHighlights: AdminPanelItem[] = [
  {
    title: 'Platform oversight',
    description:
      'The admin workspace is now structured around live operational visibility, approvals, and future release controls.',
    icon: ShieldCheck,
  },
  {
    title: 'Order governance',
    description:
      'Orders, users, and finance now have dedicated workspaces, including live release-readiness visibility for completed manual jobs.',
    icon: ClipboardList,
  },
  {
    title: 'Launch readiness',
    description:
      'This admin surface stays stable while fulfillment oversight and delayed release groundwork continue to grow into later phases.',
    icon: LineChart,
  },
];

export function formatReleaseState(
  releaseState: 'NOT_READY' | 'AWAITING_WINDOW' | 'READY_FOR_RELEASE' | 'RELEASED',
) {
  switch (releaseState) {
    case 'AWAITING_WINDOW':
      return 'In dispute window';
    case 'READY_FOR_RELEASE':
      return 'Ready for release';
    case 'RELEASED':
      return 'Released';
    case 'NOT_READY':
    default:
      return 'Not ready';
  }
}

export const adminOrdersSections: AdminPanelItem[] = [
  {
    title: 'Operational oversight',
    description:
      'This page will consolidate order review, intervention, and status visibility across the platform.',
    icon: ClipboardList,
  },
  {
    title: 'Escalation awareness',
    description:
      'Disputes, stuck requests, and edge cases are expected to flow through this workspace later.',
    icon: ShieldCheck,
  },
  {
    title: 'Cross-role visibility',
    description:
      'The eventual experience should help admins follow requesters, CBT centers, and order movement together.',
    icon: Users,
  },
];

export const adminUsersSections: AdminPanelItem[] = [
  {
    title: 'User and role visibility',
    description:
      'The user workspace is being prepared to surface individuals, tenant admins, CBT centers, and platform access together.',
    icon: Users,
  },
  {
    title: 'Approval flows',
    description:
      'CBT approval and user-state review will naturally expand from this workspace in later slices.',
    icon: ShieldCheck,
  },
  {
    title: 'Account governance',
    description:
      'This page is the future home for access control, account review, and platform safety actions.',
    icon: ClipboardList,
  },
];

export const adminFinanceSections: AdminPanelItem[] = [
  {
    title: 'Platform wallet oversight',
    description:
      'The finance workspace now exposes platform wallet totals and will keep expanding into commissions and release-aware movement.',
    icon: WalletCards,
  },
  {
    title: 'Commission visibility',
    description:
      'Funds release, CBT commissions, refunds, and wallet movement now have a live activity surface in the finance workspace.',
    icon: LineChart,
  },
  {
    title: 'Payout and risk context',
    description:
      'Withdrawals, refunds, and financial intervention tooling belong in this admin area once the remaining finance modules arrive.',
    icon: ShieldCheck,
  },
];

export const adminServicesSections: AdminPanelItem[] = [
  {
    title: 'Catalog ownership',
    description:
      'This workspace now lets admins shape the live catalog directly instead of relying on seeded-only service records.',
    icon: Layers3,
  },
  {
    title: 'Price and status control',
    description:
      'Platform fees, total pricing, activation state, and fulfillment mode can now be controlled per service from one place.',
    icon: LineChart,
  },
  {
    title: 'Document-aware intake',
    description:
      'Required fields and supporting document rules stay attached to each service so requester-side order intake remains consistent.',
    icon: ShieldCheck,
  },
];

export const adminDisputesSections: AdminPanelItem[] = [
  {
    title: 'Case review operations',
    description:
      'The disputes workspace now centralizes live case review, redo handling, and escalation context for manual CBT orders.',
    icon: MessageSquareWarning,
  },
  {
    title: 'Financial exposure groundwork',
    description:
      'Held-fund requester resolutions now refund directly, while admins can also flag a pending CBT penalty review with live exposure, platform risk, and refund-path context.',
    icon: WalletCards,
  },
  {
    title: 'Release protection',
    description:
      'Dispute states now coordinate with the delayed release engine so unresolved or redo-requested cases do not silently leak into funds release.',
    icon: ShieldCheck,
  },
];
