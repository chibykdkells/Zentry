'use client';

import { startTransition, useDeferredValue, useMemo, useState } from 'react';
import { ServiceDeliveryMode } from '@zendocx/types';
import {
  Activity,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe2,
  Loader2,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Unplug,
  X,
  Zap,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import {
  useTenantProviderReadiness,
  useTenantServiceManagementCatalog,
  useUpdateTenantServiceSelection,
  useUpdateTenantVtuProviderConfig,
  useValidateTenantVtuProviderConfig,
  type UpdateTenantVtuProviderConfigInput,
} from '@/hooks/use-tenant-services';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate, formatNaira } from '@/lib/format';
import { cn } from '@/lib/utils';

type VisibilityFilter = 'ALL' | 'OFFERED' | 'AVAILABLE' | 'AUTOMATED';
type ProviderDraft = {
  usePlatformDefault?: boolean;
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

const DELIVERY_LABELS: Record<ServiceDeliveryMode, string> = {
  [ServiceDeliveryMode.CBT_MANUAL]: 'Handled by your team',
  [ServiceDeliveryMode.API_AUTOMATED]: 'Runs through an API',
  [ServiceDeliveryMode.PIN_STOCK]: 'Runs from stored stock',
};

const ROLLOUT_LABELS: Record<'AUTO' | 'MOCK' | 'LIVE', string> = {
  AUTO: 'Use saved routing',
  MOCK: 'Use test responses',
  LIVE: 'Use live provider',
};

const PROBE_STATUS_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  unreachable: 'Unreachable',
  error: 'Needs attention',
  not_applicable: 'Not checked yet',
};

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

  const apiKeyHeader =
    draft.apiKeyHeader ?? savedConfig?.apiKeyHeader ?? 'Authorization';
  const apiKeyPrefix =
    draft.apiKeyPrefix ?? savedConfig?.apiKeyPrefix ?? 'Bearer ';

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
        error: 'API config must be a JSON object with key and value pairs.',
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

  if (draft.usePlatformDefault) {
    payload.usePlatformDefault = true;
    return payload;
  }

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
  > = [
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
        payload as Record<
          keyof UpdateTenantVtuProviderConfigInput,
          string | null | undefined
        >
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
      detail: 'This service is currently hidden from this business.',
      tone: 'neutral' as ServiceStatusTone,
    };
  }

  if (deliveryMode !== ServiceDeliveryMode.API_AUTOMATED) {
    return {
      label: 'Live in business',
      detail:
        deliveryMode === ServiceDeliveryMode.CBT_MANUAL
          ? 'Handled manually by your business team.'
          : 'Delivered from stored inventory instead of a provider API.',
      tone: 'success' as ServiceStatusTone,
    };
  }

  if (!isEnabled) {
    return {
      label: 'Paused',
      detail: 'Automated requests are turned off for this business.',
      tone: 'danger' as ServiceStatusTone,
    };
  }

  if (missingConfigCount > 0) {
    return {
      label: 'Needs setup',
      detail: 'The API connection is missing required details.',
      tone: 'warning' as ServiceStatusTone,
    };
  }

  if (probeStatus === 'healthy' && mode === 'live') {
    return {
      label: 'Live',
      detail: 'Automated requests can use the current provider connection.',
      tone: 'success' as ServiceStatusTone,
    };
  }

  if (probeStatus === 'healthy' && mode === 'mock') {
    return {
      label: 'Test mode',
      detail: 'Using test responses until you switch to the live provider.',
      tone: 'info' as ServiceStatusTone,
    };
  }

  if (probeStatus === 'unreachable' || probeStatus === 'error') {
    return {
      label: 'Attention',
      detail: 'The last connection check did not succeed.',
      tone: 'warning' as ServiceStatusTone,
    };
  }

  return {
    label: 'Unchecked',
    detail: 'Run a connection check before relying on automated requests.',
    tone: 'neutral' as ServiceStatusTone,
  };
}

function toneClasses(tone: ServiceStatusTone) {
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

function deliveryClasses(mode: ServiceDeliveryMode) {
  switch (mode) {
    case ServiceDeliveryMode.API_AUTOMATED:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case ServiceDeliveryMode.PIN_STOCK:
      return 'border-sky-200 bg-sky-50 text-sky-700';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700';
  }
}

function SectionMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
    </div>
  );
}

export function TenantBusinessIntegrationsWorkspace() {
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [draft, setDraft] = useState<ProviderDraft>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configJson, setConfigJson] = useState('');
  const [configJsonError, setConfigJsonError] = useState('');
  const [selectedServiceName, setSelectedServiceName] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(searchInput.trim().toLowerCase());

  const { readiness, loading, error, reload } = useTenantProviderReadiness();
  const {
    selection,
    categories,
    services,
    loading: servicesLoading,
    error: servicesError,
  } = useTenantServiceManagementCatalog({});
  const updateSelection = useUpdateTenantServiceSelection();
  const updateConfig = useUpdateTenantVtuProviderConfig();
  const validateConfig = useValidateTenantVtuProviderConfig();

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (categoryFilter !== 'all' && service.category.slug !== categoryFilter) {
        return false;
      }

      if (visibilityFilter === 'OFFERED' && !service.isSelected) {
        return false;
      }

      if (visibilityFilter === 'AVAILABLE' && service.isSelected) {
        return false;
      }

      if (
        visibilityFilter === 'AUTOMATED' &&
        service.deliveryMode !== ServiceDeliveryMode.API_AUTOMATED
      ) {
        return false;
      }

      if (!deferredSearch) {
        return true;
      }

      const haystack = [
        service.name,
        service.slug,
        service.description,
        service.category.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(deferredSearch);
    });
  }, [categoryFilter, deferredSearch, services, visibilityFilter]);

  const apiManagedServices = useMemo(
    () =>
      services.filter(
        (service) => service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED,
      ),
    [services],
  );

  if (loading || servicesLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <SkeletonBlock className="h-48 rounded-[2rem]" />
        <SkeletonBlock className="h-[34rem] rounded-[2rem]" />
        <SkeletonBlock className="h-64 rounded-[2rem]" />
      </div>
    );
  }

  if (!readiness || error) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <EmptyState
          title="Business integrations unavailable"
          message={error ?? 'We could not load the business integration workspace right now.'}
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
  const isTenantOverride =
    (readiness.scope.effectiveType ?? readiness.scope.type) === 'TENANT';
  const probeStatus = readiness.vtu.probe.status;
  const probeLabel =
    PROBE_STATUS_LABELS[probeStatus] ?? readiness.vtu.probe.status;
  const latestValidation = readiness.validationHistory[0] ?? null;
  const visibleServiceCount = services.filter((service) => service.isSelected).length;
  const hiddenServiceCount = Math.max(services.length - visibleServiceCount, 0);
  const readyApiServices = apiManagedServices.filter((service) => {
    const status = getServiceStatus({
      deliveryMode: service.deliveryMode,
      isSelected: service.isSelected,
      isEnabled: effectiveIsEnabled,
      probeStatus,
      mode: readiness.vtu.mode,
      missingConfigCount: readiness.vtu.missingConfig.length,
    });

    return status.label === 'Live' || status.label === 'Ready';
  }).length;
  const categoryChips = [
    {
      slug: 'all',
      label: 'All services',
      count: services.length,
    },
    ...categories.map((category) => ({
      slug: category.slug,
      label: category.name,
      count: services.filter((service) => service.category.slug === category.slug).length,
    })),
  ];
  const hasDraftControls =
    typeof draft.isEnabled === 'boolean' ||
    Boolean(draft.rolloutMode);

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
        setSuccessMessage(
          payload.usePlatformDefault
            ? 'This business is now using the Zendocx default provider.'
            : 'Business API settings saved.',
        );
        if (closeAfterSave) {
          closeConfigModal();
        }
      },
    });
  };

  const restorePlatformDefault = () => {
    setSuccessMessage('');
    updateConfig.mutate(
      {
        usePlatformDefault: true,
      },
      {
        onSuccess: () => {
          setDraft({});
          closeConfigModal();
          setSuccessMessage(
            'Custom API settings cleared. This business now uses the Zendocx default provider.',
          );
        },
      },
    );
  };

  const handleValidateConnection = () => {
    setSuccessMessage('');
    validateConfig.mutate(undefined, {
      onSuccess: () => {
        setSuccessMessage(
          'Connection check completed. Review the latest status before routing live traffic.',
        );
      },
    });
  };

  const updateServiceVisibility = (slug: string, shouldShow: boolean) => {
    setSuccessMessage('');

    const current = new Set(
      selection?.usesCustomSelection
        ? (selection?.selectedServiceSlugs ?? [])
        : services.map((service) => service.slug),
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
              ? 'Service added to this business.'
              : 'Service removed from this business.',
          );
        },
      },
    );
  };

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6 p-4 pb-28 md:p-8 md:pb-12">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(245,166,35,0.12),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(13,27,62,0.08),_transparent_28%)] px-5 py-6 md:px-8 md:py-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-600">
                  Service Connections
                </p>
                <h1 className="mt-3 max-w-2xl text-4xl font-black leading-[1.02] tracking-[-0.04em] text-slate-950">
                  Control what this business offers and how automated services connect
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
                  This business starts on the Zendocx default connection. Use
                  this page to decide which services stay visible, check whether
                  automated requests are healthy, and switch to a business-owned
                  API only when this tenant needs it.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openConfigModal()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754]"
                >
                  <Settings2 size={16} />
                  Edit business API
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
                  Check connection
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-4 md:px-8 md:py-6">
            <SectionMetric
              label="Visible in this business"
              value={`${visibleServiceCount}/${services.length}`}
              detail="These are the services people in this business can see right now."
            />
            <SectionMetric
              label="Services using an API"
              value={`${readyApiServices}/${apiManagedServices.length}`}
              detail="These services depend on either the Zendocx connection or a business-owned API."
            />
            <SectionMetric
              label="Connection in use"
              value={isTenantOverride ? 'Business API' : 'Zendocx default'}
              detail={
                isTenantOverride
                  ? 'This business has its own saved connection details.'
                  : 'This business is currently using the Zendocx shared connection.'
              }
            />
            <SectionMetric
              label="Latest connection check"
              value={probeLabel}
              detail={readiness.vtu.probe.message}
            />
          </div>
        </section>

        {successMessage ? (
          <FeedbackBanner tone="success" message={successMessage} />
        ) : null}
        {updateConfig.error ? (
          <FeedbackBanner
            tone="error"
            title="Settings could not be saved"
            message={getApiErrorMessage(
              updateConfig.error,
              'Could not save business integration settings right now.',
            )}
          />
        ) : null}
        {updateSelection.error ? (
          <FeedbackBanner
            tone="error"
            title="Service lineup could not be saved"
            message={getApiErrorMessage(
              updateSelection.error,
              'Could not update this business lineup right now.',
            )}
          />
        ) : null}
        {servicesError ? (
          <FeedbackBanner
            tone="warning"
            title="Some service data is unavailable"
            message={servicesError}
          />
        ) : null}

        <section className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5 md:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Service list
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                  Every service managed for this business
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  Show or hide services for this tenant, then see which ones use
                  Zendocx by default and which ones would use a business-owned
                  API connection.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['ALL', `All (${services.length})`],
                    ['OFFERED', `Visible (${visibleServiceCount})`],
                    ['AVAILABLE', `Hidden (${hiddenServiceCount})`],
                    ['AUTOMATED', `Uses API (${apiManagedServices.length})`],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      startTransition(() => setVisibilityFilter(value))
                    }
                    className={cn(
                      'rounded-full border px-3 py-2 text-sm font-semibold transition',
                      visibilityFilter === value
                        ? 'border-[#0D1B3E] bg-[#0D1B3E] text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                {categoryChips.map((chip) => (
                  <button
                    key={chip.slug}
                    type="button"
                    onClick={() =>
                      startTransition(() => setCategoryFilter(chip.slug))
                    }
                    className={cn(
                      'rounded-full border px-3 py-2 text-sm font-medium transition',
                      categoryFilter === chip.slug
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    {chip.label}
                    <span className="ml-2 text-xs text-inherit/80">{chip.count}</span>
                  </button>
                ))}
              </div>

              <div className="relative w-full xl:max-w-sm">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={searchInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    startTransition(() => setSearchInput(value));
                  }}
                  placeholder="Search services or categories"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:bg-white focus:ring-2 focus:ring-[#0D1B3E]/10"
                />
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <Sparkles size={18} className="mt-0.5 shrink-0 text-amber-500" />
                <div className="space-y-2 leading-7">
                  <p>
                    <span className="font-semibold text-slate-900">Zendocx default:</span>{' '}
                    automated services use the Zendocx connection until you save
                    a business-specific API.
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">Hidden services:</span>{' '}
                    hidden services disappear from this business, but you can
                    turn them back on from the same table at any time.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Service
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Customer price
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    How it is fulfilled
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Connection used
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Business status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.length ? (
                  filteredServices.map((service) => {
                    const status = getServiceStatus({
                      deliveryMode: service.deliveryMode,
                      isSelected: service.isSelected,
                      isEnabled: effectiveIsEnabled,
                      probeStatus,
                      mode: readiness.vtu.mode,
                      missingConfigCount: readiness.vtu.missingConfig.length,
                    });
                    const automationSource =
                      service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED
                        ? isTenantOverride
                          ? 'Business API'
                          : 'Zendocx default'
                        : 'No API needed';

                    return (
                      <tr
                        key={service.id}
                        className={cn(
                          'border-b border-slate-100 align-top transition',
                          service.isSelected ? 'bg-white' : 'bg-slate-50/40',
                        )}
                      >
                        <td className="px-6 py-5">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <p className="text-base font-semibold text-slate-950">
                                {service.name}
                              </p>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                {service.category.name}
                              </span>
                              {!service.isSelected ? (
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  Hidden
                                </span>
                              ) : null}
                            </div>
                            <p className="max-w-xl text-sm leading-6 text-slate-500">
                              {service.description || 'No service description has been added yet.'}
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                              <span>{service.requiredFieldsCount} form fields</span>
                              <span>{service.requiredDocumentsCount} document checks</span>
                              <span>{service.eta}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <div className="space-y-2">
                            <p className="text-lg font-bold tracking-tight text-slate-950">
                              {formatNaira(service.totalPrice)}
                            </p>
                            <p className="text-sm text-slate-500">
                              CBT commission {formatNaira(service.cbtCommission)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <div className="space-y-3">
                            <span
                              className={cn(
                                'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                                deliveryClasses(service.deliveryMode),
                              )}
                            >
                              {DELIVERY_LABELS[service.deliveryMode]}
                            </span>
                            <p className="text-sm leading-6 text-slate-500">
                              {service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED
                                ? 'Handled automatically through the connection shown on this page.'
                                : service.deliveryMode === ServiceDeliveryMode.CBT_MANUAL
                                  ? 'Handled manually by people inside this business.'
                                  : 'Delivered from stored inventory instead of a live provider connection.'}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <div className="space-y-3">
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {automationSource}
                            </span>
                            <p className="text-sm leading-6 text-slate-500">
                              {service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED
                                ? isTenantOverride
                                  ? 'This service will use the business-owned API connection.'
                                  : 'This service will use the Zendocx shared connection.'
                                : 'This service works without API credentials.'}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <div className="space-y-3">
                            <span
                              className={cn(
                                'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                                toneClasses(status.tone),
                              )}
                            >
                              {status.label}
                            </span>
                            <p className="max-w-xs text-sm leading-6 text-slate-500">
                              {status.detail}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateServiceVisibility(service.slug, !service.isSelected)
                              }
                              disabled={updateSelection.isPending}
                              className={cn(
                                'inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                                service.isSelected
                                  ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                              )}
                            >
                              {service.isSelected ? (
                                <EyeOff size={15} />
                              ) : (
                                <Eye size={15} />
                              )}
                              {service.isSelected ? 'Hide service' : 'Show service'}
                            </button>
                            {service.deliveryMode === ServiceDeliveryMode.API_AUTOMATED ? (
                              <button
                                type="button"
                                onClick={() => openConfigModal(service.name)}
                                className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#132754]"
                              >
                                <Settings2 size={15} />
                                Edit API
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12">
                      <EmptyState
                        title="No services match these filters"
                        message="Try another category, switch the current filter, or clear the search field."
                        icon={Zap}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Activity size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Automated service controls
                </p>
                <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                  Decide how automated services behave for this business
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  These settings affect every service that depends on an API.
                  Manual services and stock-based services stay available, but
                  they do not use this connection.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  API access
                </span>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Allow automated requests
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Turn this off if the business should temporarily stop using automated provider calls.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={effectiveIsEnabled}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        isEnabled: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-[#0D1B3E] focus:ring-[#0D1B3E]"
                  />
                </div>
              </label>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  API mode
                </span>
                <select
                  value={effectiveRolloutMode}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      rolloutMode: event.target.value as 'AUTO' | 'MOCK' | 'LIVE',
                    }))
                  }
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                >
                  {Object.entries(ROLLOUT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => saveDraft()}
                disabled={!hasDraftControls || updateConfig.isPending}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updateConfig.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Save automation controls
              </button>

              {isTenantOverride ? (
                <button
                  type="button"
                  onClick={restorePlatformDefault}
                  disabled={updateConfig.isPending}
                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Unplug size={16} />
                  Switch back to Zendocx default
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Globe2 size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Current connection
                </p>
                <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                  {isTenantOverride ? 'Business-owned API connection' : 'Zendocx default connection'}
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  {isTenantOverride
                    ? 'This business has its own saved endpoint and credentials for automated services.'
                    : 'No business-specific connection is saved, so automated services fall back to the Zendocx shared provider.'}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Endpoint
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {effectiveBaseUrl || 'Using the Zendocx shared endpoint'}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Last validation
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {latestValidation
                    ? `${probeLabel} · ${formatDate(latestValidation.createdAt)}`
                    : 'No validation has been run from this business workspace yet'}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {latestValidation?.probeMessage ?? readiness.vtu.probe.message}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Internal notes
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {effectiveNotes || 'No business-specific notes have been saved yet.'}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {configModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1B3E]/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  API configuration
                </p>
                <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                  {selectedServiceName
                    ? `API connection for ${selectedServiceName}`
                    : 'Business API connection'}
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  By default, this business uses Zendocx. Save a business-owned
                  endpoint only when this tenant has its own provider account
                  for automated services.
                </p>
              </div>
              <button
                type="button"
                onClick={closeConfigModal}
                className="rounded-full border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-800">
                    API endpoint URL
                  </span>
                  <input
                    value={draft.baseUrl ?? savedConfig?.baseUrl ?? ''}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        baseUrl: event.target.value,
                      }))
                    }
                    placeholder="https://api.example.com/path"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:bg-white focus:ring-2 focus:ring-[#0D1B3E]/10"
                  />
                </label>

                <div className="grid gap-4">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-800">
                      Routing mode
                    </span>
                    <select
                      value={effectiveRolloutMode}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          rolloutMode: event.target.value as
                            | 'AUTO'
                            | 'MOCK'
                            | 'LIVE',
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:bg-white focus:ring-2 focus:ring-[#0D1B3E]/10"
                    >
                      {Object.entries(ROLLOUT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={effectiveIsEnabled}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          isEnabled: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[#0D1B3E] focus:ring-[#0D1B3E]"
                    />
                    Enable automated API routing for this business
                  </label>
                </div>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-800">
                  API config (JSON)
                </span>
                <textarea
                  value={configJson}
                  onChange={(event) => {
                    setConfigJson(event.target.value);
                    if (configJsonError) {
                      setConfigJsonError('');
                    }
                  }}
                  rows={10}
                  placeholder={`{\n  "apiKey": "your-live-key",\n  "apiKeyHeader": "Authorization",\n  "apiKeyPrefix": "Bearer ",\n  "healthPath": "/health"\n}`}
                  className={cn(
                    'w-full rounded-[1.5rem] border bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 outline-none transition',
                    configJsonError
                      ? 'border-rose-300 bg-rose-50'
                      : 'border-slate-200 focus:border-[#0D1B3E] focus:bg-white focus:ring-2 focus:ring-[#0D1B3E]/10',
                  )}
                />
                {configJsonError ? (
                  <p className="text-sm text-rose-600">{configJsonError}</p>
                ) : null}
              </label>

              <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
                The connection saved here is reused by every service in this
                business that depends on an API. Manual services and stock-based
                services remain in the list, but they do not use these credentials.
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {isTenantOverride ? (
                  <button
                    type="button"
                    onClick={restorePlatformDefault}
                    disabled={updateConfig.isPending}
                    className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Unplug size={16} />
                    Use Zendocx default instead
                  </button>
                ) : (
                  <p className="text-sm text-slate-500">
                    Leave this blank if the Zendocx default connection is enough for this business.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={closeConfigModal}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    saveDraft({
                      configValue: configJson,
                      closeAfterSave: true,
                    })
                  }
                  disabled={updateConfig.isPending}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {updateConfig.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Settings2 size={16} />
                  )}
                  Save API connection
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
