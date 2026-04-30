'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { FilePreviewGallery } from '@/components/shared/file-preview-gallery';
import {
  useReviewOrderDispute,
  useReviewOrderDisputeFinancialFollowUp,
} from '@/hooks/use-disputes';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { OrderDetail } from '@/hooks/use-orders';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate, formatNaira } from '@/lib/format';
import { DisputeStatus, FulfillmentType } from '@zendocx/types';

export function AdminDisputeReviewPanel({ detail }: { detail: OrderDetail }) {
  const reviewDispute = useReviewOrderDispute();
  const followUpReview = useReviewOrderDisputeFinancialFollowUp();
  const usesMobileSheet = useMediaQuery('(max-width: 1279px)');
  const [resolutionNote, setResolutionNote] = useState(
    detail.dispute?.resolutionNote ?? '',
  );
  const [flagCbtPenalty, setFlagCbtPenalty] = useState(false);

  if (!detail.dispute || !detail.disputeGroundwork) {
    return null;
  }

  const canMoveToReview = detail.dispute.status === DisputeStatus.OPEN;
  const canRequestRedo =
    (detail.dispute.status === DisputeStatus.OPEN ||
      detail.dispute.status === DisputeStatus.UNDER_REVIEW) &&
    detail.fulfillmentType === FulfillmentType.MANUAL &&
    Boolean(detail.assignedCbt) &&
    Boolean(detail.resultFileUrl);
  const canResolve =
    detail.dispute.status === DisputeStatus.OPEN ||
    detail.dispute.status === DisputeStatus.UNDER_REVIEW ||
    detail.dispute.status === DisputeStatus.REDO_REQUESTED;
  const supportsCbtResolution =
    detail.fulfillmentType === FulfillmentType.MANUAL &&
    Boolean(detail.assignedCbt) &&
    Boolean(detail.resultFileUrl);
  const canCompleteManualRefund =
    detail.dispute.status === DisputeStatus.RESOLVED_FOR_REQUESTER &&
    detail.disputeGroundwork.refundStatus === 'MANUAL_RECONCILIATION_REQUIRED';
  const canExecutePenalty =
    detail.dispute.status === DisputeStatus.RESOLVED_FOR_REQUESTER &&
    detail.disputeGroundwork.penaltyStatus === 'PENDING_REVIEW';

  const runAction = async (
    action:
      | 'UNDER_REVIEW'
      | 'RESOLVED_FOR_REQUESTER'
      | 'RESOLVED_FOR_CBT'
      | 'REQUEST_REDO',
  ) => {
    try {
      const response = await reviewDispute.mutateAsync({
        orderId: detail.id,
        action,
        resolutionNote,
        flagCbtPenalty:
          action === 'RESOLVED_FOR_REQUESTER' ? flagCbtPenalty : undefined,
      });
      toast.success(response.message ?? 'Dispute updated successfully.');
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, 'Could not update the dispute right now.'),
      );
    }
  };

  const runFinancialFollowUp = async (
    action:
      | 'COMPLETE_MANUAL_REFUND'
      | 'EXECUTE_CBT_PENALTY'
      | 'WAIVE_CBT_PENALTY',
  ) => {
    try {
      const response = await followUpReview.mutateAsync({
        orderId: detail.id,
        action,
        note: resolutionNote,
      });
      toast.success(response.message ?? 'Dispute follow-up updated successfully.');
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          'Could not update the dispute follow-up right now.',
        ),
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-rose-900">
            Dispute review
          </h3>
          <p className="mt-2 text-sm leading-6 text-rose-800">
            Review the requester complaint, capture a decision note, and decide
            whether this case stays in review, returns to CBT for redo, resolves
            for the requester, or returns to the completion flow.
          </p>
        </div>
        <span className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-800">
          {detail.dispute.status.replaceAll('_', ' ')}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricPill label="Opened" value={formatDate(detail.dispute.createdAt)} />
        <MetricPill
          label="Resolved"
          value={
            detail.dispute.resolvedAt
              ? formatDate(detail.dispute.resolvedAt)
              : 'Pending'
          }
        />
        <MetricPill
          label="Redo deadline"
          value={
            detail.dispute.redoDeadline
              ? formatDate(detail.dispute.redoDeadline)
              : 'Not set'
          }
        />
        <MetricPill
          label="Redo submitted"
          value={
            detail.dispute.redoCompletedAt
              ? formatDate(detail.dispute.redoCompletedAt)
              : 'Not submitted'
          }
        />
      </div>

      <div className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Requester reason</p>
        <p className="mt-2 leading-6">{detail.dispute.reason}</p>
      </div>

      <FilePreviewGallery
        title="Evidence files"
        files={detail.dispute.evidenceUrls}
        emptyMessage="No evidence files were attached to this dispute."
        className="border-rose-200 bg-rose-50/40"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricPill
          label="Refund exposure"
          value={formatNaira(detail.disputeGroundwork.refundAmount)}
        />
        <MetricPill
          label="CBT penalty candidate"
          value={
            detail.disputeGroundwork.cbtPenaltyCandidate
              ? formatNaira(detail.disputeGroundwork.cbtPenaltyCandidate)
              : 'Not applicable'
          }
        />
        <MetricPill
          label="Platform at risk"
          value={formatNaira(detail.disputeGroundwork.platformAmountAtRisk)}
        />
        <MetricPill
          label="Refund path"
          value={
            detail.disputeGroundwork.refundPath === 'ESCROW_REFUND_PREVIEW'
              ? 'Held funds refund'
              : 'Manual reconciliation'
          }
        />
        <MetricPill
          label="Refund status"
          value={detail.disputeGroundwork.refundStatus.replaceAll('_', ' ')}
        />
        <MetricPill
          label="Penalty status"
          value={detail.disputeGroundwork.penaltyStatus.replaceAll('_', ' ')}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-700">
        <p className="font-semibold text-slate-900">Financial groundwork</p>
        <p className="mt-2">
          Requester-favor decisions now refund held funds automatically. CBT
          penalty handling still enters the ledger as a review candidate instead
          of deducting funds immediately.
        </p>
        <ul className="mt-3 space-y-1 text-slate-600">
          <li>
            Requester-favor resolution covers{' '}
            {formatNaira(detail.disputeGroundwork.refundAmount)} into refund
            handling.
          </li>
          <li>
            CBT penalty groundwork is capped at{' '}
            {detail.disputeGroundwork.cbtPenaltyCandidate
              ? formatNaira(detail.disputeGroundwork.cbtPenaltyCandidate)
              : 'N/A'}
            , and becomes a pending review entry only when you flag it below.
          </li>
          <li>
            Request redo keeps funds on hold while the CBT resubmits the result.
          </li>
        </ul>
        {detail.disputeGroundwork.refundReference ? (
          <p className="mt-3 text-xs font-medium text-slate-500">
            Refund reference: {detail.disputeGroundwork.refundReference}
          </p>
        ) : null}
        {detail.disputeGroundwork.penaltyReference ? (
          <p className="mt-2 text-xs font-medium text-slate-500">
            Penalty reference: {detail.disputeGroundwork.penaltyReference}
          </p>
        ) : null}
      </div>

      <textarea
        value={resolutionNote}
        onChange={(event) => setResolutionNote(event.target.value)}
        rows={4}
        placeholder="Add the review finding, decision context, and any operator instructions."
        className="w-full rounded-3xl border border-rose-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
      />

      {detail.disputeGroundwork.cbtPenaltyCandidate ? (
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={flagCbtPenalty}
            onChange={(event) => setFlagCbtPenalty(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-700 focus:ring-rose-200"
          />
          <span className="leading-6">
            Flag CBT penalty review for{' '}
            {formatNaira(detail.disputeGroundwork.cbtPenaltyCandidate)} if this
            case is resolved for the requester.
          </span>
        </label>
      ) : null}

      {canCompleteManualRefund || canExecutePenalty ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">
            Follow-up actions
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use these after the dispute decision when the refund must be handled manually or when a pending CBT penalty review needs a final decision.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {canCompleteManualRefund ? (
              <ActionButton
                disabled={followUpReview.isPending}
                pending={followUpReview.isPending}
                label="Mark manual refund completed"
                onClick={() => {
                  void runFinancialFollowUp('COMPLETE_MANUAL_REFUND');
                }}
                tone="neutral"
              />
            ) : null}
            {canExecutePenalty ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ActionButton
                  disabled={followUpReview.isPending}
                  pending={followUpReview.isPending}
                  label="Apply CBT penalty"
                  onClick={() => {
                    void runFinancialFollowUp('EXECUTE_CBT_PENALTY');
                  }}
                  tone="rose"
                />
                <ActionButton
                  disabled={followUpReview.isPending}
                  pending={followUpReview.isPending}
                  label="Waive CBT penalty"
                  onClick={() => {
                    void runFinancialFollowUp('WAIVE_CBT_PENALTY');
                  }}
                  tone="neutral"
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={
          usesMobileSheet
            ? 'sticky bottom-0 -mx-5 mt-5 flex flex-col gap-3 border-t border-rose-100 bg-white/95 px-5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-sm'
            : 'flex flex-wrap gap-3'
        }
      >
        <ActionButton
          disabled={!canMoveToReview || reviewDispute.isPending || followUpReview.isPending}
          pending={reviewDispute.isPending}
          label="Move to review"
          onClick={() => {
            void runAction('UNDER_REVIEW');
          }}
          tone="neutral"
        />
        <ActionButton
          disabled={!canRequestRedo || reviewDispute.isPending || followUpReview.isPending || resolutionNote.trim().length < 3}
          pending={reviewDispute.isPending}
          label="Request redo"
          onClick={() => {
            void runAction('REQUEST_REDO');
          }}
          tone="amber"
        />
        <ActionButton
          disabled={!canResolve || reviewDispute.isPending || followUpReview.isPending || resolutionNote.trim().length < 3}
          pending={reviewDispute.isPending}
          label="Resolve for requester"
          onClick={() => {
            void runAction('RESOLVED_FOR_REQUESTER');
          }}
          tone="rose"
        />
        {supportsCbtResolution ? (
          <ActionButton
            disabled={!canResolve || reviewDispute.isPending || followUpReview.isPending || resolutionNote.trim().length < 3}
            pending={reviewDispute.isPending}
            label="Resolve for CBT"
            onClick={() => {
              void runAction('RESOLVED_FOR_CBT');
            }}
            tone="emerald"
          />
        ) : null}
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ActionButton({
  disabled,
  pending,
  label,
  onClick,
  tone,
}: {
  disabled: boolean;
  pending: boolean;
  label: string;
  onClick: () => void;
  tone: 'neutral' | 'amber' | 'rose' | 'emerald';
}) {
  const toneClass =
    tone === 'neutral'
      ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      : tone === 'amber'
        ? 'bg-amber-600 text-white shadow-sm hover:bg-amber-700'
        : tone === 'rose'
          ? 'bg-rose-700 text-white shadow-sm hover:bg-rose-800'
          : 'bg-emerald-700 text-white shadow-sm hover:bg-emerald-800';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D1B3E]/15 disabled:cursor-not-allowed disabled:opacity-60 ${toneClass} ${tone === 'neutral' ? 'w-full sm:w-auto' : 'w-full'}`}
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : null}
      {label}
    </button>
  );
}
