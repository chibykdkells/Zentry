'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ServiceDeliveryMode } from '@zendocx/types';
import {
  Activity,
  ArrowUpRight,
  Eye,
  EyeOff,
  Globe2,
  Loader2,
  LockKeyhole,
  PlugZap,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { PageHero } from '@/components/shared/page-hero';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import { useTenantServiceManagementCatalog } from '@/hooks/use-tenant-services';
import {
  useTenantProviderReadiness,
  useUpdateTenantServiceSelection,
  useUpdateTenantVtuProviderConfig,
  useValidateTenantVtuProviderConfig,
  type UpdateTenantVtuProviderConfigInput,
} from '@/hooks/use-tenant-services';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate, formatNaira } from '@/lib/format';
import { cn } from '@/lib/utils';

type IntegrationView = 'services' | 'custom-api';

type ProviderDraft = {
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
};

type ServiceStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const DELIVERY_LABELS: Record<ServiceDeliveryMode, string> = {
  [ServiceDeliveryMode.CBT_MANUAL]: 'Handled by your team',
  [ServiceDeliveryMode.API_AUTOMATED]: 'Automated',
  [ServiceDeliveryMode.PIN_STOCK]: 'Stock based',
};

const ROLLOUT_LABELS: Record<'AUTO' | 'MOCK' | 'LIVE', string> = {
  AUTO: 'Auto routing',
  LIVE: 'Live API',
  MOCK: 'Mock mode',
};

const PROBE_STATUS_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  unreachable: 'Unreachable',
  error: 'Error',
  not_applicable: 'Not checked yet',
};

const CONFIG_FIELD_KEYS = [
  'apiKey',
  'apiKeyHeader',
  'apiKeyPrefix',
  'healthPath',
  'airtimePath',
  'dataPurchasePath',
  'dataPlansPath',
  'cablePlansPath',
  'cableVerifyPath',
  'cablePurchasePath',
  'electricityVerifyPath',
  'electricityPurchasePath',
] as const;

type ConfigFieldKey = (typeof CONFIG_FIELD_KEYS)[number];
type NullableDraftKey = Exclude<ConfigFieldKey, 'apiKey'> | 'notes';

function buildConfigEditorValue(
  savedConfig:
    | {
        apiKeyHeader: string | null;
        apiKeyPrefix: string | null;
        healthPath: string | null;
        airtimePath: string | null;
        dataPurchasePath: string | null;
        dataPlansPath: string | null;
        cablePlansPath: string | null;
        cableVerifyPath: string | null;
        cablePurchasePath: string | null;
        electricityVerifyPath: string | null;
        electricityPurchasePath: string | null;
      }
    | null
    | undefined,
  draft: ProviderDraft,
) {
  const config: Record<string, string> = {};

  const apiKeyHeader = draft.apiKeyHeader ?? savedConfig?.apiKeyHeader ?? 'Authorization';
  const apiKeyPrefix = draft.apiKeyPrefix ?? savedConfig?.apiKeyPrefix ?? 'Bearer';

  if (draft.apiKey?.trim()) {
    config.apiKey = draft.apiKey.trim();
  }

  if (apiKeyHeader) {
    config.apiKeyHeader = apiKeyHeader;
  }

  if (apiKeyPrefix) {
    config.apiKeyPrefix = apiKeyPrefix;
  }

  const pathFields: Array<[keyof ProviderDraft, string | null | undefined]> = [
    ['healthPath', draft.healthPath ?? savedConfig?.healthPath],
    ['airtimePath', draft.airtimePath ?? savedConfig?.airtimePath],
    ['dataPurchasePath', draft.dataPurchasePath ?? savedConfig?.dataPurchasePath],
    ['dataPlansPath', draft.dataPlansPath ?? savedConfig?.dataPlansPath],
    ['cablePlansPath', draft.cablePlansPath ?? savedConfig?.cablePlansPath],
    ['cableVerifyPath', draft.cableVerifyPath ?? savedConfig?.cableVerifyPath],
    ['cablePurchasePath', draft.cablePurchasePath ?? savedConfig?.cablePurchasePath],
    [
      'electricityVerifyPath',
      draft.electricityVerifyPath ?? savedConfig?.electricityVerifyPath,
    ],
    [
      'electricityPurchasePath',
      draft.electricityPurchasePath ?? savedConfig?.electricityPurchasePath,
    ],
  ];

  pathFields.forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      config[key] = value.trim();
    }
  });

  return JSON.stringify(config, null, 2);
}

function parseConfigEditorValue(
  value: string,
): { ok: true; data: Partial<ProviderDraft> } | { ok: false; error: string } {
  if (!value.trim()) {
    return { ok: true, data: {} };
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;

    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return {
        ok: false,
        error: 'API config must be a JSON object with key/value pairs.',
      };
    }

    const draft: Partial<Record<ConfigFieldKey, string>> = {};

    CONFIG_FIELD_KEYS.forEach((key) => {
      const rawValue = parsed[key];
      if (typeof rawValue === 'undefined') {
        return;
      }

      if (rawValue === null || rawValue === '') {
        draft[key] = '';
        return;
      }

      if (typeof rawValue !== 'string') {
        throw new Error(`"${key}" must be a string value.`);
      }

      draft[key] = rawValue.trim();
    });

    return { ok: true, data: draft };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'The API config JSON could not be parsed.',
    };
  }
}

function buildUpdatePayload(draft: ProviderDraft): UpdateTenantVtuProviderConfigInput {
  const payload: UpdateTenantVtuProviderConfigInput = {};

  if (typeof draft.isEnabled === 'boolean') {
    payload.isEnabled = draft.isEnabled;
  }

  if (draft.rolloutMode) {
    payload.rolloutMode = draft.rolloutMode;
  }

  if (typeof draft.baseUrl !== 'undefined') {
    payload.baseUrl = draft.baseUrl.trim() || null;
  }

  if (draft.apiKey?.trim()) {
    payload.apiKey = draft.apiKey.trim();
  }

  if (draft.clearApiKey) {
    payload.clearApiKey = true;
  }

  const nullableFieldMap: Array<
    [NullableDraftKey, keyof UpdateTenantVtuProviderConfigInput]
  > =
    [
      ['apiKeyHeader', 'apiKeyHeader'],
      ['apiKeyPrefix', 'apiKeyPrefix'],
      ['healthPath', 'healthPath'],
      ['airtimePath', 'airtimePath'],
      ['dataPurchasePath', 'dataPurchasePath'],
      ['dataPlansPath', 'dataPlansPath'],
      ['cablePlansPath', 'cablePlansPath'],
      ['cableVerifyPath', 'cableVerifyPath'],
      ['cablePurchasePath', 'cablePurchasePath'],
      ['electricityVerifyPath', 'electricityVerifyPath'],
      ['electricityPurchasePath', 'electricityPurchasePath'],
      ['notes', 'notes'],
    ];

  nullableFieldMap.forEach(([draftKey, payloadKey]) => {
    if (typeof draft[draftKey] !== 'undefined') {
      const normalizedValue = draft[draftKey]?.trim() || null;
      (
        payload as Record<keyof UpdateTenantVtuProviderConfigInput, string | null | undefined>
      )[payloadKey] = normalizedValue;
    }
  });

  return payload;
}

function getServiceStatus({
  deliveryMode,
  isSelected,
  isEnabled,
  probeStatus,
  mode,
  missingConfigCount,
}: {
  deliveryMode: ServiceDeliveryMode;
  isSelected: boolean;
  isEnabled: boolean;
  probeStatus: string;
  mode: 'live' | 'mock';
  missingConfigCount: number;
}) {
  if (!isSelected) {
    return {
      label: 'Hidden',
      detail: 'Not currently offered in this business.',
      tone: 'neutral' as ServiceStatusTone,
    };
  }

  if (deliveryMode !== ServiceDeliveryMode.API_AUTOMATED) {
    return {
      label: 'Ready',
      detail:
        deliveryMode === ServiceDeliveryMode.CBT_MANUAL
          ? 'Handled by your team without a live API connection.'
          : 'Handled through stocked inventory instead of a live API call.',
      tone: 'success' as ServiceStatusTone,
    };
  }

  if (!isEnabled) {
    return {
      label: 'Disabled',
      detail: 'Automation is paused for this tenant.',
      tone: 'danger' as ServiceStatusTone,
    };
  }

  if (missingConfigCount > 0) {
    return {
      label: 'Needs setup',
      detail: 'Add connection details before activating live traffic.',
      tone: 'warning' as ServiceStatusTone,
    };
  }

  if (probeStatus === 'healthy' && mode === 'live') {
    return {
      label: 'Ready',
      detail: 'Live requests can route through this provider.',
      tone: 'success' as ServiceStatusTone,
    };
  }

  if (probeStatus === 'healthy' && mode === 'mock') {
    return {
      label: 'Mock mode',
      detail: 'Using test responses until you switch to live mode.',
      tone: 'info' as ServiceStatusTone,
    };
  }

  if (probeStatus === 'unreachable' || probeStatus === 'error') {
    return {
      label: 'Attention',
      detail: 'The last health check could not reach the provider.',
      tone: 'warning' as ServiceStatusTone,
    };
  }

  return {
    label: 'Pending check',
    detail: 'Validate this connection to confirm it is ready.',
    tone: 'neutral' as ServiceStatusTone,
  };
}

function statusToneClasses(tone: ServiceStatusTone) {
  switch (tone) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'danger':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'info':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

export default function TenantProvidersPage() {
  const [activeView, setActiveView] = useState<IntegrationView>('services');
  const [draft, setDraft] = useState<ProviderDraft>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configJson, setConfigJson] = useState('');
  const [configJsonError, setConfigJsonError] = useState('');
  const [selectedServiceName, setSelectedServiceName] = useState<string | null>(null);

  const { readiness, loading, error, reload } = useTenantProviderReadiness();
  const {
    services,
    selection,
    loading: servicesLoading,
    error: servicesError,
  } = useTenantServiceManagementCatalog({});
  const updateSelection = useUpdateTenantServiceSelection();
  const updateConfig = useUpdateTenantVtuProviderConfig();
  const validateConfig = useValidateTenantVtuProviderConfig();

  const apiManagedServices = useMemo(
    () =>
      services.filter(
        (service) => service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED,
      ),
    [services],
  );

  const groupedServices = useMemo(() => {
    const groups = new Map<
      string,
      {
        slug: string;
        name: string;
        description: string | null;
        services: typeof services;
      }
    >();

    services.forEach((service) => {
      const existing = groups.get(service.category.slug);
      if (existing) {
        existing.services.push(service);
        return;
      }

      groups.set(service.category.slug, {
        slug: service.category.slug,
        name: service.category.name,
        description: service.category.description,
        services: [service],
      });
    });

    return Array.from(groups.values());
  }, [services]);

  if (loading || servicesLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <SkeletonBlock className="h-44 rounded-[2rem]" />
        <SkeletonBlock className="h-28 rounded-[2rem]" />
        <SkeletonBlock className="h-[32rem] rounded-[2rem]" />
      </div>
    );
  }

  if (!readiness || error) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <EmptyState
          title="API integrations unavailable"
          message={error ?? 'We could not load the integration workspace right now.'}
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

  const savedConfig = readiness.savedConfig;
  const effectiveIsEnabled = draft.isEnabled ?? savedConfig?.isEnabled ?? true;
  const effectiveRolloutMode = draft.rolloutMode ?? savedConfig?.rolloutMode ?? 'AUTO';
  const effectiveBaseUrl = draft.baseUrl ?? savedConfig?.baseUrl ?? '';
  const effectiveNotes = draft.notes ?? savedConfig?.notes ?? '';
  const probeStatus = readiness.vtu.probe.status;
  const probeLabel = PROBE_STATUS_LABELS[probeStatus] ?? readiness.vtu.probe.status;
  const isTenantOverride =
    (readiness.scope.effectiveType ?? readiness.scope.type) === 'TENANT';
  const latestValidation = readiness.validationHistory[0] ?? null;
  const usesCustomSelection = selection?.usesCustomSelection ?? false;
  const selectedServiceSlugs = selection?.selectedServiceSlugs ?? [];
  const effectiveSelectedSlugs = usesCustomSelection
    ? selectedServiceSlugs
    : services.map((service) => service.slug);
  const visibleServiceCount = effectiveSelectedSlugs.length;
  const hiddenServiceCount = Math.max(services.length - visibleServiceCount, 0);
  const hiddenApiServices = apiManagedServices.filter((service) => !service.isSelected).length;
  const readyApiServices = apiManagedServices.filter((service) =>
    service.isSelected &&
    effectiveIsEnabled &&
    readiness.vtu.missingConfig.length === 0 &&
    probeStatus === 'healthy',
  ).length;
  const hasDraftChanges = Object.keys(draft).length > 0;

  const openConfigModal = (serviceName?: string) => {
    setSelectedServiceName(serviceName ?? null);
    setConfigJson(buildConfigEditorValue(savedConfig, draft));
    setConfigJsonError('');
    setConfigModalOpen(true);
  };

  const closeConfigModal = () => {
    setConfigModalOpen(false);
    setConfigJsonError('');
    setSelectedServiceName(null);
  };

  const saveDraft = ({
    configValue,
    closeAfterSave = false,
  }: {
    configValue?: string;
    closeAfterSave?: boolean;
  } = {}) => {
    setSuccessMessage('');
    setConfigJsonError('');

    let mergedDraft = { ...draft };

    if (typeof configValue === 'string') {
      const parsedConfig = parseConfigEditorValue(configValue);
      if (!parsedConfig.ok) {
        setConfigJsonError(parsedConfig.error);
        return;
      }

      mergedDraft = {
        ...mergedDraft,
        ...parsedConfig.data,
      };
    }

    const payload = buildUpdatePayload(mergedDraft);
    if (!Object.keys(payload).length) {
      if (closeAfterSave) {
        closeConfigModal();
      }
      return;
    }

    updateConfig.mutate(payload, {
      onSuccess: () => {
        setDraft({});
        setSuccessMessage('API integration settings saved.');
        if (closeAfterSave) {
          closeConfigModal();
        }
      },
    });
  };

  const handleValidateConnection = () => {
    setSuccessMessage('');
    validateConfig.mutate(undefined, {
      onSuccess: () => {
        setSuccessMessage('Connection check completed. Review the status cards below.');
      },
    });
  };

  const updateServiceVisibility = (slug: string, shouldShow: boolean) => {
    setSuccessMessage('');

    const current = new Set(
      usesCustomSelection ? selectedServiceSlugs : services.map((service) => service.slug),
    );

    if (shouldShow) {
      current.add(slug);
    } else {
      current.delete(slug);
    }

    updateSelection.mutate(
      {
        usesCustomSelection: true,
        selectedServiceSlugs: Array.from(current),
      },
      {
        onSuccess: () => {
          setSuccessMessage(
            shouldShow
              ? 'Service is now visible in this business.'
              : 'Service has been hidden from this business.',
          );
        },
      },
    );
  };

  const restoreAllServices = () => {
    setSuccessMessage('');
    updateSelection.mutate(
      {
        usesCustomSelection: false,
        selectedServiceSlugs,
      },
      {
        onSuccess: () => {
          setSuccessMessage('This business now shows every service from the platform catalog.');
        },
      },
    );
  };

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6 p-4 pb-28 md:p-8 md:pb-12">
        <PageHero
          eyebrow="API Integrations"
          title="Service connections for this business"
          description="See which services customers can use, decide whether requests should use the Zendocx default connection or your own provider, and confirm what still needs setup."
          actions={
            <>
              <button
                type="button"
                onClick={() => openConfigModal()}
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-button px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong"
              >
                <Settings2 size={16} />
                Configure API
              </button>
              <button
                type="button"
                onClick={handleValidateConnection}
                disabled={validateConfig.isPending}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {validateConfig.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ShieldCheck size={16} />
                )}
                Validate connection
              </button>
            </>
          }
          aside={
            <>
              <SummaryCard
                icon={Activity}
                label="Connection check"
                value={probeLabel}
                helper={readiness.vtu.probe.message}
                tone={
                  probeStatus === 'healthy'
                    ? 'success'
                    : probeStatus === 'not_applicable'
                      ? 'neutral'
                      : 'warning'
                }
              />
              <SummaryCard
                icon={PlugZap}
                label="Connection source"
                value={isTenantOverride ? 'Your provider' : 'Zendocx default'}
                helper={`${visibleServiceCount} visible service${visibleServiceCount === 1 ? '' : 's'} across this business`}
                tone="neutral"
              />
              <SummaryCard
                icon={Sparkles}
                label="API-ready services"
                value={`${readyApiServices}/${apiManagedServices.length}`}
                helper="Services already selected and ready for live API traffic"
                tone="neutral"
              />
            </>
          }
        />

        {successMessage ? <FeedbackBanner tone="success" message={successMessage} /> : null}
        {updateConfig.error ? (
          <FeedbackBanner
            tone="error"
            message={getApiErrorMessage(
              updateConfig.error,
              'Could not save the integration settings right now.',
            )}
          />
        ) : null}
        {validateConfig.error ? (
          <FeedbackBanner
            tone="error"
            message={getApiErrorMessage(
              validateConfig.error,
              'Could not validate the connection right now.',
            )}
          />
        ) : null}
        {updateSelection.error ? (
          <FeedbackBanner
            tone="error"
            message={getApiErrorMessage(
              updateSelection.error,
              'Could not update service visibility right now.',
            )}
          />
        ) : null}
        {servicesError ? (
          <FeedbackBanner
            tone="warning"
            message={servicesError}
            className="border-dashed"
          />
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Business setup
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">
                  Decide how this business handles connected services
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Use this section to pause or resume automated traffic, choose whether requests
                  should stay in mock mode or go live, and keep the service list below aligned
                  with what this business is actually offering.
                </p>
              </div>

              <button
                type="button"
                onClick={() => saveDraft()}
                disabled={updateConfig.isPending || !hasDraftChanges}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-button px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updateConfig.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Save changes
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[0.72fr_0.28fr]">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Connection owner</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isTenantOverride
                        ? 'This business already uses its own saved provider details.'
                        : 'This business is still using the Zendocx default provider details.'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-semibold',
                      isTenantOverride
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600',
                    )}
                  >
                    {isTenantOverride ? 'Custom API' : 'Platform default'}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Request mode
                    </span>
                    <select
                      value={effectiveRolloutMode}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          rolloutMode: event.target.value as 'AUTO' | 'MOCK' | 'LIVE',
                        }))
                      }
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                    >
                      {Object.entries(ROLLOUT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Automation
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {effectiveIsEnabled ? 'Enabled' : 'Paused'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Pause automated requests without deleting the saved connection details.
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={effectiveIsEnabled}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            isEnabled: !effectiveIsEnabled,
                          }))
                        }
                        className={cn(
                          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors',
                          effectiveIsEnabled ? 'bg-brand-button' : 'bg-slate-200',
                        )}
                      >
                        <span
                          className={cn(
                            'h-6 w-6 rounded-full bg-white shadow transition-transform',
                            effectiveIsEnabled ? 'translate-x-5' : 'translate-x-0',
                          )}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <MetricCard
                  label="Visible services"
                  value={String(visibleServiceCount)}
                  helper="Services customers can currently see in this business"
                />
                <MetricCard
                  label="Hidden services"
                  value={String(hiddenServiceCount)}
                  helper="Services intentionally hidden from this business"
                />
                <MetricCard
                  label="Latest validation"
                  value={
                    latestValidation ? formatDate(latestValidation.createdAt) : 'Not yet run'
                  }
                  helper={latestValidation?.probeMessage ?? 'Run a connection check after updates'}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Connection details
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {effectiveBaseUrl || readiness.vtu.providerName}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {effectiveBaseUrl
                ? 'Requests route through the business-specific endpoint shown here.'
                : 'No business-specific endpoint has been saved yet, so the Zendocx default handles this business.'}
            </p>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => openConfigModal()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                <SlidersHorizontal size={16} />
                Open configuration modal
              </button>

              <Link
                href="/wallet"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Open wallet workspace
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {[
            { key: 'services', label: 'Service list' },
            { key: 'custom-api', label: 'Connection settings' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveView(tab.key as IntegrationView)}
              className={cn(
                'rounded-2xl px-4 py-2.5 text-sm font-semibold transition',
                activeView === tab.key
                  ? 'bg-brand-button text-white'
                  : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeView === 'services' ? (
          <>
            <FeedbackBanner
              tone="info"
              title="Use this page in two passes"
              message="First decide which services this business should show to customers. Then confirm which ones need a live API connection and whether they should use the Zendocx default or this business's own provider."
            />

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{visibleServiceCount}</span>{' '}
                visible
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{hiddenServiceCount}</span>{' '}
                hidden
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{hiddenApiServices}</span>{' '}
                API service{hiddenApiServices === 1 ? '' : 's'} still hidden
              </div>
              {usesCustomSelection ? (
                <button
                  type="button"
                  onClick={restoreAllServices}
                  disabled={updateSelection.isPending}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateSelection.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Sparkles size={15} />
                  )}
                  Show every platform service
                </button>
              ) : null}
            </div>

            {groupedServices.length ? (
              <div className="space-y-5">
                {groupedServices.map((group) => (
                  <section
                    key={group.slug}
                    className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="border-b border-slate-100 px-5 py-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{group.name}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {group.description || 'Services grouped under this category.'}
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                          {group.services.length} service{group.services.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-[1080px] divide-y divide-slate-100">
                        <thead className="bg-slate-50/80">
                          <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            <th className="px-5 py-3">Service</th>
                            <th className="px-5 py-3">Delivery</th>
                            <th className="px-5 py-3">Visibility</th>
                            <th className="px-5 py-3">How it runs</th>
                            <th className="px-5 py-3">Price</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.services.map((service) => {
                            const status = getServiceStatus({
                              deliveryMode: service.deliveryMode,
                              isSelected: service.isSelected,
                              isEnabled: effectiveIsEnabled,
                              probeStatus,
                              mode: readiness.vtu.mode,
                              missingConfigCount: readiness.vtu.missingConfig.length,
                            });

                            return (
                              <tr key={service.id} className="align-top">
                                <td className="px-5 py-4">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {service.name}
                                    </p>
                                    <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                                      {service.description || 'Customer-facing service.'}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-5 py-4">
                                  <span
                                    className={cn(
                                      'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
                                      service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : service.deliveryMode === ServiceDeliveryMode.CBT_MANUAL
                                          ? 'bg-amber-50 text-amber-700'
                                          : 'bg-blue-50 text-blue-700',
                                    )}
                                  >
                                    {DELIVERY_LABELS[service.deliveryMode]}
                                  </span>
                                </td>
                                <td className="px-5 py-4">
                                  <span
                                    className={cn(
                                      'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                                      service.isSelected
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : 'border-slate-200 bg-slate-50 text-slate-500',
                                    )}
                                  >
                                    {service.isSelected ? 'Visible to customers' : 'Hidden'}
                                  </span>
                                </td>
                                <td className="px-5 py-4">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED
                                      ? isTenantOverride
                                        ? 'Your API connection'
                                        : 'Zendocx default connection'
                                      : service.deliveryMode === ServiceDeliveryMode.CBT_MANUAL
                                        ? 'Your team completes the request'
                                        : 'Zendocx stock inventory'}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    {service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED
                                      ? readiness.vtu.providerName
                                      : 'No API setup required'}
                                  </p>
                                </td>
                                <td className="px-5 py-4">
                                  <p className="text-sm font-semibold text-slate-900">
                                    {formatNaira(service.totalPrice)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    Published customer price
                                  </p>
                                </td>
                                <td className="px-5 py-4">
                                  <span
                                    className={cn(
                                      'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                                      statusToneClasses(status.tone),
                                    )}
                                  >
                                    {status.label}
                                  </span>
                                  <p className="mt-2 max-w-[15rem] text-xs leading-5 text-slate-500">
                                    {status.detail}
                                  </p>
                                </td>
                                <td className="px-5 py-4">
                                  <div className="flex justify-end gap-2">
                                    {service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED ? (
                                      <button
                                        type="button"
                                        onClick={() => openConfigModal(service.name)}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                      >
                                        <Settings2 size={15} />
                                        Configure API
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateServiceVisibility(service.slug, !service.isSelected)
                                      }
                                      disabled={updateSelection.isPending}
                                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {service.isSelected ? <EyeOff size={15} /> : <Eye size={15} />}
                                      {service.isSelected ? 'Hide' : 'Show'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No services available yet"
                message="This business is not currently exposing any services. Open the service workspace first, then come back here to handle visibility and API setup."
                icon={PlugZap}
                action={
                  <Link
                    href="/tenant/services"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Open services
                  </Link>
                }
              />
            )}
          </>
        ) : (
          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Custom API summary
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  One saved API connection powers this tenant's automated services
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Save tenant-specific credentials when this business should route its own
                  requests. Leave credentials blank to keep using the platform default instead.
                </p>

                <div className="mt-5 space-y-3">
                  <InfoRow
                    icon={Globe2}
                    label="Endpoint base URL"
                    value={effectiveBaseUrl || 'Using platform default endpoint'}
                  />
                  <InfoRow
                    icon={ShieldCheck}
                    label="Saved mode"
                    value={ROLLOUT_LABELS[effectiveRolloutMode]}
                  />
                  <InfoRow
                    icon={LockKeyhole}
                    label="Credential source"
                    value={
                      isTenantOverride
                        ? 'Tenant credentials saved for this business'
                        : 'Platform credentials are still in effect'
                    }
                  />
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Notes
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {effectiveNotes ||
                    'No internal integration notes have been saved for this tenant yet.'}
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Recommended flow
              </p>
              <div className="mt-4 space-y-4">
                {[
                  {
                    title: '1. Choose whether this tenant should inherit or override',
                    description:
                      'If the platform default is enough, keep credentials blank. If the tenant has its own provider account, save the tenant endpoint and API config.',
                  },
                  {
                    title: '2. Validate the provider connection',
                    description:
                      'Run a health check after each credential change so you can see whether the provider is healthy, unreachable, or still waiting for setup.',
                  },
                  {
                    title: '3. Confirm service visibility and wallet readiness',
                    description:
                      'Use the automated services tab to confirm which services are exposed to this tenant and then fund the wallet before live traffic starts.',
                  },
                ].map((step) => (
                  <div
                    key={step.title}
                    className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>

              <FeedbackBanner
                tone="warning"
                title="Custom credentials affect all automated services"
                message="This tenant workspace currently uses one shared VTU connection. Saving credentials here changes how every automated service in this business routes its requests."
                className="mt-5"
              />

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => openConfigModal()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-button px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong"
                >
                  <Settings2 size={16} />
                  Configure shared API
                </button>
                <Link
                  href="/tenant/services"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Review service visibility
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>

      {configModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 px-4 py-0 md:items-center md:px-6 md:py-8">
          <div
            className="absolute inset-0"
            onClick={closeConfigModal}
            aria-hidden="true"
          />

          <section className="relative z-[81] flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-slate-200 bg-white shadow-2xl md:rounded-[2rem]">
            <div className="border-b border-slate-100 px-5 py-4 md:px-6 md:py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    API Configuration
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    {selectedServiceName
                      ? `${selectedServiceName} uses this tenant connection`
                      : 'Configure the tenant API connection'}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Save the endpoint URL and JSON config the tenant should use when automated
                    services route through its own provider account.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeConfigModal}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close API configuration"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-6">
              {configJsonError ? (
                <FeedbackBanner tone="error" message={configJsonError} />
              ) : null}

              <div>
                <label
                  htmlFor="tenant-api-endpoint"
                  className="text-sm font-medium text-slate-700"
                >
                  API endpoint URL
                </label>
                <input
                  id="tenant-api-endpoint"
                  value={effectiveBaseUrl}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      baseUrl: event.target.value,
                    }))
                  }
                  placeholder="https://api.example.com/v1"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                />
              </div>

              <div>
                <label
                  htmlFor="tenant-api-config-json"
                  className="text-sm font-medium text-slate-700"
                >
                  API config (JSON)
                </label>
                <textarea
                  id="tenant-api-config-json"
                  value={configJson}
                  onChange={(event) => setConfigJson(event.target.value)}
                  rows={11}
                  placeholder={`{\n  "apiKeyHeader": "Authorization",\n  "apiKeyPrefix": "Bearer"\n}`}
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Supported keys include <code>apiKey</code>, <code>apiKeyHeader</code>,
                  <code> apiKeyPrefix</code>, and optional endpoint override fields like{' '}
                  <code>healthPath</code> or <code>dataPlansPath</code>.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <input
                  type="checkbox"
                  checked={draft.clearApiKey ?? false}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      clearApiKey: event.target.checked,
                      apiKey: event.target.checked ? '' : current.apiKey,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="text-sm font-semibold text-slate-900">
                    Revert to platform credentials
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-500">
                    Use this if the tenant should stop using its own saved key and fall back to
                    the platform default provider again.
                  </span>
                </span>
              </label>

              <div>
                <label
                  htmlFor="tenant-api-notes"
                  className="text-sm font-medium text-slate-700"
                >
                  Internal notes
                </label>
                <textarea
                  id="tenant-api-notes"
                  value={effectiveNotes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Contact person, renewal schedule, or deployment note"
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                />
              </div>

              <FeedbackBanner
                tone="warning"
                message="Credentials stored here are used by this tenant's automated services. Tenants that keep the platform default do not need custom values in this modal."
              />
            </div>

            <div className="border-t border-slate-100 bg-white px-5 py-4 md:px-6">
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={closeConfigModal}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveDraft({ configValue: configJson, closeAfterSave: true })}
                  disabled={updateConfig.isPending}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-button px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateConfig.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Save API config
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  helper: string;
  tone: 'success' | 'warning' | 'neutral';
}) {
  return (
    <div
      className={cn(
        'rounded-[1.5rem] border p-4 shadow-sm',
        tone === 'success'
          ? 'border-emerald-200 bg-emerald-50'
          : tone === 'warning'
            ? 'border-amber-200 bg-amber-50'
            : 'border-slate-200 bg-slate-50/70',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
            tone === 'success'
              ? 'bg-emerald-100 text-emerald-600'
              : tone === 'warning'
                ? 'bg-amber-100 text-amber-600'
                : 'bg-white text-slate-500',
          )}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{helper}</p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
        <Icon size={18} />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
