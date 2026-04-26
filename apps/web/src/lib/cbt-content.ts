import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  Briefcase,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  TrendingUp,
  Upload,
  WalletCards,
} from 'lucide-react';

export interface CbtPanelItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const cbtDashboardHighlights: CbtPanelItem[] = [
  {
    title: 'Approved-center workflow',
    description:
      'This workspace is shaped for approved CBT operators who will pick, complete, and track assigned jobs.',
    icon: ShieldCheck,
  },
  {
    title: 'Job readiness',
    description:
      'Job pool, assignment flow, and earnings surfaces now have a real information structure instead of dead placeholders.',
    icon: Briefcase,
  },
  {
    title: 'Withdrawal direction',
    description:
      'Earnings and withdraw pages now explain how release timing and payout requests will fit into the platform.',
    icon: WalletCards,
  },
];

export const cbtJobPoolGuidance = [
  {
    title: 'Browse available jobs',
    description:
      'Eligible requests will appear here once real order assignment is connected to approved CBT centers.',
    icon: Briefcase,
  },
  {
    title: 'Claim and complete',
    description:
      'The future workflow will let the first eligible center claim a job, process it, and upload results.',
    icon: Upload,
  },
  {
    title: 'Track release timing',
    description:
      'Completion, dispute windows, and commission release all feed into the earnings workspace.',
    icon: Clock3,
  },
];

export const cbtMyJobsSections = [
  {
    title: 'Assigned work',
    description:
      'Jobs claimed or assigned to your center will be grouped here for focused execution.',
    icon: Briefcase,
  },
  {
    title: 'In progress',
    description:
      'Active requests will surface the next required action and help keep delivery timelines clear.',
    icon: Clock3,
  },
  {
    title: 'Completed deliveries',
    description:
      'Completed jobs will stay visible alongside their release and dispute context.',
    icon: CheckCircle2,
  },
];

export const cbtEarningsSections = [
  {
    title: 'Release-aware earnings',
    description:
      'Completed jobs only become withdrawable after the review window passes and funds are released.',
    icon: TrendingUp,
  },
  {
    title: 'Withdrawable balance',
    description:
      'Your wallet balance shows what is already released, while pending and blocked earnings remain separate.',
    icon: WalletCards,
  },
  {
    title: 'Payout history',
    description:
      'Commission history is now grouped here so you can trace each released order back to the requester and service.',
    icon: Banknote,
  },
];

export const cbtWithdrawSections = [
  {
    title: 'Request withdrawals',
    description:
      'Released wallet balance can now be submitted as a payout request directly from this workspace.',
    icon: Banknote,
  },
  {
    title: 'Track payout review',
    description:
      'Each payout request stays visible through pending review, processing, completion, or rejection.',
    icon: WalletCards,
  },
];
