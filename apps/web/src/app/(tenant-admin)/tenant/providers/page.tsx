'use client';

import { useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Save,
  ShieldCheck,
  Unplug,
  Zap,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { PageHero } from '@/components/shared/page-hero';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import {
  useTenantProviderReadiness,
  useUpdateTenantVtuProviderConfig,
  useValidateTenantVtuProviderConfig,
} from '@/hooks/use-tenant-services';
import { getApiErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/utils';

const ROLLOUT_LABELS = {
  AUTO: 'Auto — let the platform decide',
  LIVE: 'Live — always use real API',
  MOCK: 'Mock — test mode only',
};

const PROBE_STATUS_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  unreachable: 'Unreachable',
  error: 'Error',
  not_applicable: 'Not checked',
};

export default function TenantProvidersPage() {
  const { readiness, loading, error, reload } = useTenantProviderReadiness();
  const updateConfig = useUpdateTenantVtuProviderConfig();
  const validateConfig = useValidateTenantVtuProviderConfig();
  const [showEndpoints, setShowEndpoints] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [draft, setDraft] = useState<{
    isEnabled?: boolean;
    rolloutMode?: 'AUTO' | 'MOCK' | 'LIVE';
    baseUrl?: string;
    apiKey?: string;
    clearApiKey?: boolean;
    apiKeyHeader?: string;
    apiKeyPrefix?: string;
    healthPath?: string;
    airtimePath?: string;
    dataPurchasePath?: string;
    dataPlansPath?: string;
    cablePlansPath?: string;
    cableVerifyPath?: string;
    cablePurchasePath?: string;
    electricityVerifyPath?: string;
    electricityPurchasePath?: string;
    notes?: string;
  }>({});

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        <SkeletonBlock className="h-44 rounded-[2rem]" />
        <SkeletonBlock className="h-96 rounded-[2rem]" />
      </div>
    );
  }

  if (!readiness || error) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        <EmptyState
          title="API Integrations unavailable"
          message={error ?? 'We could not load the integration configuration right now.'}
          action={
            <button
              type="button"
              onClick={reload}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Try again
            </button>
          }
        />
      </div>
    );
  }

  const saved = readiness.savedConfig;
  const probe = readiness.vtu.probe;
  const probeStatus = probe.status as string;
  const probeLabel = PROBE_STATUS_LABELS[probeStatus] ?? probeStatus;

  const isEnabled = draft.isEnabled ?? saved?.isEnabled ?? true;
  const rolloutMode = draft.rolloutMode ?? saved?.rolloutMode ?? 'AUTO';
  const baseUrl = draft.baseUrl ?? saved?.baseUrl ?? '';
  const apiKeyHeader = draft.apiKeyHeader ?? saved?.apiKeyHeader ?? '';
  const apiKeyPrefix = draft.apiKeyPrefix ?? saved?.apiKeyPrefix ?? '';
  const healthPath = draft.healthPath ?? saved?.healthPath ?? '';
  const airtimePath = draft.airtimePath ?? saved?.airtimePath ?? '';
  const dataPurchasePath = draft.dataPurchasePath ?? saved?.dataPurchasePath ?? '';
  const dataPlansPath = draft.dataPlansPath ?? saved?.dataPlansPath ?? '';
  const cablePlansPath = draft.cablePlansPath ?? saved?.cablePlansPath ?? '';
  const cableVerifyPath = draft.cableVerifyPath ?? saved?.cableVerifyPath ?? '';
  const cablePurchasePath = draft.cablePurchasePath ?? saved?.cablePurchasePath ?? '';
  const electricityVerifyPath = draft.electricityVerifyPath ?? saved?.electricityVerifyPath ?? '';
  const electricityPurchasePath =
    draft.electricityPurchasePath ?? saved?.electricityPurchasePath ?? '';
  const notes = draft.notes ?? saved?.notes ?? '';

  const isTenantOverride =
    (readiness.scope.effectiveType ?? readiness.scope.type) === 'TENANT';
  const isHealthy = probeStatus === 'healthy';
  const isLive = readiness.vtu.mode === 'live';

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    setSuccessMessage('');

    const payload: Parameters<typeof updateConfig.mutate>[0] = {};
    if (draft.isEnabled !== undefined) payload.isEnabled = draft.isEnabled;
    if (draft.rolloutMode) payload.rolloutMode = draft.rolloutMode;
    if (draft.baseUrl !== undefined) payload.baseUrl = draft.baseUrl.trim() || null;
    if (draft.apiKey?.trim()) payload.apiKey = draft.apiKey.trim();
    if (draft.clearApiKey) payload.clearApiKey = true;
    if (draft.apiKeyHeader !== undefined)
      payload.apiKeyHeader = draft.apiKeyHeader.trim() || null;
    if (draft.apiKeyPrefix !== undefined)
      payload.apiKeyPrefix = draft.apiKeyPrefix.trim() || null;
    if (draft.healthPath !== undefined) payload.healthPath = draft.healthPath.trim() || null;
    if (draft.airtimePath !== undefined) payload.airtimePath = draft.airtimePath.trim() || null;
    if (draft.dataPurchasePath !== undefined)
      payload.dataPurchasePath = draft.dataPurchasePath.trim() || null;
    if (draft.dataPlansPath !== undefined)
      payload.dataPlansPath = draft.dataPlansPath.trim() || null;
    if (draft.cablePlansPath !== undefined)
      payload.cablePlansPath = draft.cablePlansPath.trim() || null;
    if (draft.cableVerifyPath !== undefined)
      payload.cableVerifyPath = draft.cableVerifyPath.trim() || null;
    if (draft.cablePurchasePath !== undefined)
      payload.cablePurchasePath = draft.cablePurchasePath.trim() || null;
    if (draft.electricityVerifyPath !== undefined)
      payload.electricityVerifyPath = draft.electricityVerifyPath.trim() || null;
    if (draft.electricityPurchasePath !== undefined)
      payload.electricityPurchasePath = draft.electricityPurchasePath.trim() || null;
    if (draft.notes !== undefined) payload.notes = draft.notes.trim() || null;

    updateConfig.mutate(payload, {
      onSuccess: () => {
        setDraft({});
        setSuccessMessage('API integration settings saved.');
      },
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <PageHero
        eyebrow="API Integrations"
        title="VTU provider connection"
        description="Connect your own VTU API provider or inherit the platform default. Your API key is encrypted and never exposed after saving."
      />

      {/* Status summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div
          className={cn(
            'flex items-center gap-3 rounded-2xl border p-4',
            isHealthy
              ? 'border-emerald-200 bg-emerald-50'
              : probeStatus === 'not_applicable'
                ? 'border-slate-200 bg-slate-50'
                : 'border-amber-200 bg-amber-50',
          )}
        >
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              isHealthy
                ? 'bg-emerald-100 text-emerald-600'
                : probeStatus === 'not_applicable'
                  ? 'bg-slate-100 text-slate-400'
                  : 'bg-amber-100 text-amber-600',
            )}
          >
            {isHealthy ? <ShieldCheck size={18} /> : <Unplug size={18} />}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              API health
            </p>
            <p
              className={cn(
                'mt-0.5 text-sm font-semibold',
                isHealthy
                  ? 'text-emerald-700'
                  : probeStatus === 'not_applicable'
                    ? 'text-slate-500'
                    : 'text-amber-700',
              )}
            >
              {probeLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Activity size={18} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Provider
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {readiness.vtu.providerName}
            </p>
            <p className="text-xs text-slate-400">
              {isTenantOverride ? 'Your configuration' : 'Platform default'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Zap size={18} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Services affected
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {readiness.automatedServices.length} automated
            </p>
            <p className="text-xs text-slate-400">
              {isLive ? 'Live mode' : 'Mock mode'}
            </p>
          </div>
        </div>
      </div>

      {/* Missing config warning */}
      {readiness.vtu.missingConfig.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">
            Missing configuration
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {readiness.vtu.missingConfig.map((item) => (
              <li key={item} className="text-sm text-amber-700">
                · {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {successMessage ? <FeedbackBanner tone="success" message={successMessage} /> : null}
      {updateConfig.error ? (
        <FeedbackBanner
          tone="error"
          message={getApiErrorMessage(
            updateConfig.error,
            'Could not save right now. Please try again.',
          )}
        />
      ) : null}

      {/* Main config form */}
      <form onSubmit={handleSave} className="space-y-4">
        {/* General settings */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-sm font-semibold text-slate-900">General settings</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Enable or disable this integration and choose how it routes API calls.
            </p>
          </div>
          <div className="space-y-5 px-5 py-5">
            {/* Enable toggle */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-900">Enable VTU integration</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Disable to temporarily stop automated service processing for this business.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isEnabled}
                onClick={() => setDraft((prev) => ({ ...prev, isEnabled: !isEnabled }))}
                className={cn(
                  'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors',
                  isEnabled ? 'bg-brand-button' : 'bg-slate-200',
                )}
              >
                <span
                  className={cn(
                    'h-6 w-6 rounded-full bg-white shadow transition-transform',
                    isEnabled ? 'translate-x-5' : 'translate-x-0',
                  )}
                />
              </button>
            </div>

            {/* Rollout mode */}
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="rollout-mode">
                Rollout mode
              </label>
              <p className="mt-0.5 text-xs text-slate-500">
                Auto lets the platform decide based on health probes. Switch to Live when ready for real transactions.
              </p>
              <select
                id="rollout-mode"
                value={rolloutMode}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    rolloutMode: e.target.value as 'AUTO' | 'MOCK' | 'LIVE',
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              >
                {Object.entries(ROLLOUT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* API credentials */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-sm font-semibold text-slate-900">API credentials</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Leave blank to inherit the platform-default provider. Your API key is stored encrypted.
            </p>
          </div>
          <div className="space-y-4 px-5 py-5">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="base-url">
                Base URL
              </label>
              <input
                id="base-url"
                value={baseUrl}
                onChange={(e) => setDraft((prev) => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="https://api.yourprovider.com"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="api-key">
                API key
                {saved?.apiKeyConfigured ? (
                  <span className="ml-2 text-xs font-normal text-emerald-600">
                    Saved · ends in {saved.apiKeyLast4}
                  </span>
                ) : (
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    Inheriting platform default
                  </span>
                )}
              </label>
              <input
                id="api-key"
                type="password"
                value={draft.apiKey ?? ''}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    apiKey: e.target.value,
                    clearApiKey: false,
                  }))
                }
                placeholder={
                  saved?.apiKeyConfigured ? 'Enter a new key to replace' : 'Enter API key'
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              />
              {saved?.apiKeyConfigured ? (
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-rose-600">
                  <input
                    type="checkbox"
                    checked={draft.clearApiKey ?? false}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        clearApiKey: e.target.checked,
                        apiKey: e.target.checked ? '' : prev.apiKey,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Remove saved key and revert to platform default
                </label>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="key-header">
                  Auth header name
                </label>
                <input
                  id="key-header"
                  value={apiKeyHeader}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, apiKeyHeader: e.target.value }))
                  }
                  placeholder="Authorization"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="key-prefix">
                  Key prefix
                </label>
                <input
                  id="key-prefix"
                  value={apiKeyPrefix}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, apiKeyPrefix: e.target.value }))
                  }
                  placeholder="Bearer"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Endpoint paths — collapsible advanced section */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setShowEndpoints((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">Endpoint paths</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Advanced — only change these if your provider uses custom API paths.
              </p>
            </div>
            <span className="text-slate-400">
              {showEndpoints ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {showEndpoints ? (
            <div className="border-t border-slate-100 px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Health check', id: 'health-path', key: 'healthPath' as const, value: healthPath, placeholder: '/health' },
                  { label: 'Airtime purchase', id: 'airtime-path', key: 'airtimePath' as const, value: airtimePath, placeholder: '/airtime' },
                  { label: 'Data purchase', id: 'data-purchase-path', key: 'dataPurchasePath' as const, value: dataPurchasePath, placeholder: '/data/purchase' },
                  { label: 'Data plans', id: 'data-plans-path', key: 'dataPlansPath' as const, value: dataPlansPath, placeholder: '/data/plans' },
                  { label: 'Cable TV plans', id: 'cable-plans-path', key: 'cablePlansPath' as const, value: cablePlansPath, placeholder: '/cable/plans' },
                  { label: 'Cable TV verify', id: 'cable-verify-path', key: 'cableVerifyPath' as const, value: cableVerifyPath, placeholder: '/cable/verify' },
                  { label: 'Cable TV purchase', id: 'cable-purchase-path', key: 'cablePurchasePath' as const, value: cablePurchasePath, placeholder: '/cable/purchase' },
                  { label: 'Electricity verify', id: 'electricity-verify-path', key: 'electricityVerifyPath' as const, value: electricityVerifyPath, placeholder: '/electricity/verify' },
                  { label: 'Electricity purchase', id: 'electricity-purchase-path', key: 'electricityPurchasePath' as const, value: electricityPurchasePath, placeholder: '/electricity/purchase' },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="text-sm font-medium text-slate-700" htmlFor={field.id}>
                      {field.label}
                    </label>
                    <input
                      id={field.id}
                      value={field.value}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.placeholder}
                      className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Notes */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-5">
          <label className="text-sm font-medium text-slate-700" htmlFor="notes">
            Internal notes
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            Visible only to admins. Use this for contact details or configuration reminders.
          </p>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
            placeholder="e.g. Provider contact: support@provider.com — renewed annually"
            className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
          />
        </section>

        <button
          type="submit"
          disabled={updateConfig.isPending}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand-button px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={16} />
          {updateConfig.isPending ? 'Saving…' : 'Save settings'}
        </button>
      </form>

      {/* Health probe */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-sm font-semibold text-slate-900">Connection test</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Run a live probe against your API health endpoint to confirm the connection is working.
          </p>
        </div>
        <div className="px-5 py-5 space-y-4">
          {probe.message ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {probe.message}
            </div>
          ) : null}

          {validateConfig.error ? (
            <FeedbackBanner
              tone="error"
              message={getApiErrorMessage(validateConfig.error, 'Health probe failed.')}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={validateConfig.isPending}
              onClick={() => validateConfig.mutate()}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {validateConfig.isPending ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <Activity size={15} />
              )}
              {validateConfig.isPending ? 'Running probe…' : 'Run connection test'}
            </button>

            {saved?.lastValidatedAt ? (
              <p className="text-xs text-slate-400">
                Last tested {new Date(saved.lastValidatedAt).toLocaleString()} ·{' '}
                <span
                  className={cn(
                    'font-medium',
                    saved.lastValidationStatus?.includes('SUCCESS')
                      ? 'text-emerald-600'
                      : 'text-amber-600',
                  )}
                >
                  {saved.lastValidationStatus?.replace(/_/g, ' ') ?? 'Unknown'}
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Validation history */}
      {readiness.validationHistory.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-sm font-semibold text-slate-900">Test history</p>
            <p className="mt-0.5 text-xs text-slate-500">
              The last {readiness.validationHistory.length} probe results for this integration.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {readiness.validationHistory.map((event) => (
              <div key={event.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="space-y-0.5">
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      event.probeStatus === 'healthy'
                        ? 'text-emerald-600'
                        : event.probeStatus === 'not_applicable'
                          ? 'text-slate-400'
                          : 'text-rose-600',
                    )}
                  >
                    {PROBE_STATUS_LABELS[event.probeStatus] ?? event.probeStatus}
                  </p>
                  {event.probeMessage ? (
                    <p className="text-xs text-slate-500">{event.probeMessage}</p>
                  ) : null}
                  <p className="text-xs text-slate-400">
                    Mode: {event.effectiveMode}
                    {event.missingConfig.length > 0
                      ? ` · Missing: ${event.missingConfig.join(', ')}`
                      : ''}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-slate-400">
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Affected services */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-sm font-semibold text-slate-900">Automated services</p>
          <p className="mt-0.5 text-xs text-slate-500">
            These services in your business will route through this VTU connection.
          </p>
        </div>
        {readiness.automatedServices.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {readiness.automatedServices.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                  <p className="text-xs text-slate-400">{service.category.name}</p>
                </div>
                {service.providerKey ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    {service.providerKey}
                  </span>
                ) : (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    No provider key
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8">
            <EmptyState
              title="No automated services yet"
              message="Automated services exposed to your customers will appear here once configured."
              icon={Zap}
            />
          </div>
        )}
      </section>
    </div>
  );
}
