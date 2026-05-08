'use client';
import { type ElementType, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  TENANT_ADMIN_PERMISSIONS,
  type TenantAdminPermission,
  UserRole,
} from '@zendocx/types';
import { Eye, ExternalLink, Globe, LayoutTemplate, Palette, ShieldCheck } from 'lucide-react';
import {
  useCreateTenantAdmin,
  useDeleteTenantAdmin,
  useTenantDomainVerification,
  useTenantOverview,
  useTenantUsers,
  useUpdateTenantAdmin,
  useUpdateTenantSettings,
  useUploadTenantLogo,
  useVerifyTenantCustomDomain,
} from '@/hooks/use-tenant-admin';
import { DetailModal } from '@/components/shared/detail-modal';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { PageHeader } from '@/components/shared/page-header';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import { EmptyState } from '@/components/shared/empty-state';
import { InfoHint } from '@/components/shared/info-hint';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import {
  hasTenantAdminPermission,
  tenantAdminPermissionLabels,
} from '@/lib/tenant-admin-permissions';
import { useAuthStore } from '@/stores/auth.store';

const fontStyleOptions = [
  {
    value: 'modern' as const,
    label: 'Modern',
    description: 'A clean product font for digital-first business portals.',
    fontFamily: '"Plus Jakarta Sans", "Avenir Next", "Segoe UI", sans-serif',
  },
  {
    value: 'classic' as const,
    label: 'Classic',
    description: 'A more formal serif look for traditional business branding.',
    fontFamily: 'Georgia, "Times New Roman", serif',
  },
  {
    value: 'clean' as const,
    label: 'Clean',
    description: 'A straightforward system look with strong readability.',
    fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
  },
];

const homepageTemplateOptions = [
  {
    value: 'spotlight' as const,
    label: 'Spotlight',
    description:
      'A polished brand-first homepage with a strong introduction and focused calls to action.',
  },
  {
    value: 'service-grid' as const,
    label: 'Service grid',
    description:
      'A clearer service-first homepage that lets visitors scan the catalog quickly.',
  },
  {
    value: 'guided-flow' as const,
    label: 'Guided flow',
    description:
      'A process-led homepage that explains how manual document handling works step by step.',
  },
];

const emptyStep = { title: '', description: '' };
const domainStatusCopy: Record<
  | 'VERIFIED'
  | 'READY_TO_VERIFY'
  | 'DNS_RECORD_NOT_FOUND'
  | 'DNS_RECORD_MISMATCH'
  | 'DNS_LOOKUP_ERROR'
  | 'SERVICE_NOT_CONFIGURED',
  { tone: 'success' | 'warning' | 'error' | 'info'; title: string; message: string }
> = {
  VERIFIED: {
    tone: 'success',
    title: 'Domain verified',
    message: 'The TXT record matches and this custom domain is ready to route safely.',
  },
  READY_TO_VERIFY: {
    tone: 'warning',
    title: 'Ready for verification',
    message: 'The expected TXT record is visible in DNS. You can run verification now to mark the domain as trusted.',
  },
  DNS_RECORD_NOT_FOUND: {
    tone: 'warning',
    title: 'TXT record not found yet',
    message: 'ZenDocx could not see the expected TXT record yet. This usually means the DNS record is missing or still propagating.',
  },
  DNS_RECORD_MISMATCH: {
    tone: 'error',
    title: 'TXT record found, but value is wrong',
    message: 'A TXT record exists at the verification host, but the value does not match the token ZenDocx expects.',
  },
  DNS_LOOKUP_ERROR: {
    tone: 'error',
    title: 'DNS lookup failed',
    message: 'ZenDocx could not complete the lookup right now. This may be a temporary DNS or resolver issue.',
  },
  SERVICE_NOT_CONFIGURED: {
    tone: 'warning',
    title: 'Platform verification service needs setup',
    message: 'The platform is still using a fallback verification secret. A platform operator should configure DOMAIN_VERIFICATION_SECRET before relying on custom domains in production.',
  },
};

export default function TenantSettingsPage() {
  const currentUser = useAuthStore((state) => state.user);
  const { overview, loading, error, reload } = useTenantOverview();
  const updateTenantSettings = useUpdateTenantSettings();
  const uploadTenantLogo = useUploadTenantLogo();
  const verifyTenantCustomDomain = useVerifyTenantCustomDomain();
  const createTenantAdmin = useCreateTenantAdmin();
  const updateTenantAdmin = useUpdateTenantAdmin();
  const deleteTenantAdmin = useDeleteTenantAdmin();

  const [openTile, setOpenTile] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    name?: string;
    logoUrl?: string;
    customDomain?: string;
    primaryColor?: string;
    accentColor?: string;
    textColor?: string;
    buttonColor?: string;
    fontStyle?: 'modern' | 'classic' | 'clean';
    homepageTemplate?: 'spotlight' | 'service-grid' | 'guided-flow';
    homepageHeading?: string;
    homepageSubheading?: string;
    homepageAbout?: string;
    homepageManualSteps?: Array<{
      title: string;
      description: string;
    }>;
  }>({});
  const [newAdmin, setNewAdmin] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    permissions: TenantAdminPermission[];
  }>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    permissions: [...TENANT_ADMIN_PERMISSIONS],
  });
  const [logoUploadMessage, setLogoUploadMessage] = useState('');
  const {
    users: tenantAdmins,
    loading: tenantAdminsLoading,
    error: tenantAdminsError,
  } = useTenantUsers({
    page: 1,
    limit: 12,
    role: UserRole.TENANT_ADMIN,
  });
  const canManageBusinessSettings = hasTenantAdminPermission(
    currentUser,
    'MANAGE_BUSINESS_SETTINGS',
  );
  const canManageBusinessAdmins = hasTenantAdminPermission(
    currentUser,
    'MANAGE_BUSINESS_ADMINS',
  );
  const tenant = overview?.tenant ?? null;
  const name = draft.name ?? tenant?.name ?? '';
  const logoUrl = draft.logoUrl ?? tenant?.logoUrl ?? '';
  const customDomain = draft.customDomain ?? tenant?.customDomain ?? '';
  const savedCustomDomain = tenant?.customDomain ?? '';
  const primaryColor = draft.primaryColor ?? tenant?.primaryColor ?? '#0D1B3E';
  const accentColor = draft.accentColor ?? tenant?.accentColor ?? '#F5A623';
  const textColor = draft.textColor ?? tenant?.textColor ?? '#10203C';
  const buttonColor = draft.buttonColor ?? tenant?.buttonColor ?? '#0D1B3E';
  const fontStyle = (draft.fontStyle ??
    tenant?.fontStyle ??
    'modern') as 'modern' | 'classic' | 'clean';
  const homepageTemplate = (draft.homepageTemplate ??
    tenant?.homepageTemplate ??
    'spotlight') as 'spotlight' | 'service-grid' | 'guided-flow';
  const homepageHeading = draft.homepageHeading ?? tenant?.homepageHeading ?? '';
  const homepageSubheading =
    draft.homepageSubheading ?? tenant?.homepageSubheading ?? '';
  const homepageAbout = draft.homepageAbout ?? tenant?.homepageAbout ?? '';
  const selectedFont =
    fontStyleOptions.find((option) => option.value === fontStyle) ??
    fontStyleOptions[0];
  const homepageTemplateMeta =
    homepageTemplateOptions.find((option) => option.value === homepageTemplate) ??
    homepageTemplateOptions[0];
  const safeManualSteps = useMemo(() => {
    const homepageManualSteps =
      draft.homepageManualSteps ?? tenant?.homepageManualSteps ?? [];
    const steps = homepageManualSteps.length
      ? homepageManualSteps
      : [emptyStep, emptyStep, emptyStep];
    return Array.from({ length: 3 }, (_, index) => steps[index] ?? emptyStep);
  }, [draft.homepageManualSteps, tenant?.homepageManualSteps]);
  const {
    verification,
    loading: verificationLoading,
    error: verificationError,
    reload: reloadVerification,
  } = useTenantDomainVerification(Boolean(savedCustomDomain));

  const handleSaveSettings = () => {
    if (!canManageBusinessSettings) return;
    updateTenantSettings.mutate(
      {
        name: name.trim(),
        logoUrl: logoUrl.trim() || null,
        customDomain: customDomain.trim() || null,
        primaryColor,
        accentColor,
        textColor,
        buttonColor,
        fontStyle,
        homepageTemplate,
        homepageHeading: homepageHeading.trim(),
        homepageSubheading: homepageSubheading.trim(),
        homepageAbout: homepageAbout.trim(),
        homepageManualSteps: safeManualSteps.map((step) => ({
          title: step.title.trim(),
          description: step.description.trim(),
        })),
      },
      {
        onSuccess: () => {
          setDraft({});
          toast.success('Settings saved.');
        },
      },
    );
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <SkeletonBlock className="h-44 rounded-[2rem]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-28 rounded-[1.5rem]" />
          ))}
        </div>
      </div>
    );
  }

  if (!overview || error) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <EmptyState
          title="Tenant settings unavailable"
          message={error ?? 'We could not load tenant settings right now.'}
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

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Could not copy the ${label.toLowerCase()} right now.`);
    }
  };

  const portalUrl =
    overview.tenant.customDomainVerified && overview.tenant.customDomain
      ? `https://${overview.tenant.customDomain}`
      : `/?tenant=${overview.tenant.slug}&preview=1`;

  const settingsSaveFooter = (
    <div className="flex flex-wrap items-center gap-3">
      {updateTenantSettings.error ? (
        <p className="text-sm text-rose-600">
          {getApiErrorMessage(updateTenantSettings.error, 'Could not save settings.')}
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleSaveSettings}
        disabled={updateTenantSettings.isPending || !canManageBusinessSettings}
        className="rounded-2xl bg-brand-button px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {updateTenantSettings.isPending ? 'Saving...' : 'Save settings'}
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader
        title="Portal Settings"
        description="Brand details, domain, homepage content, and admin access for this business."
      />

      {/* Tile grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <DashTile
          icon={Palette}
          label="Brand details"
          value={name || 'Not configured'}
          color="bg-[#0D1B3E] text-white"
          onClick={() => setOpenTile('brand')}
        />
        <DashTile
          icon={Globe}
          label="Custom domain"
          value={savedCustomDomain || 'Not set'}
          color="bg-cyan-600 text-white"
          onClick={() => setOpenTile('domain')}
        />
        <DashTile
          icon={LayoutTemplate}
          label="Homepage"
          value={homepageTemplateMeta.label}
          color="bg-amber-500 text-white"
          onClick={() => setOpenTile('homepage')}
        />
        <DashTile
          icon={Eye}
          label="Portal preview"
          value="Preview portal"
          color="bg-emerald-600 text-white"
          onClick={() => setOpenTile('preview')}
        />
        <DashTile
          icon={ShieldCheck}
          label="Admin access"
          value={
            tenantAdminsLoading
              ? '...'
              : `${tenantAdmins.length} admin${tenantAdmins.length === 1 ? '' : 's'}`
          }
          color="bg-rose-500 text-white"
          onClick={() => setOpenTile('admins')}
        />
      </div>

      {/* Brand details modal */}
      <DetailModal
        open={openTile === 'brand'}
        onClose={() => setOpenTile(null)}
        title="Brand details"
        description="Logo, colors, and font style for this business portal."
        width="xl"
        footer={settingsSaveFooter}
      >
        <div className="space-y-5">
          {!canManageBusinessSettings ? (
            <FeedbackBanner
              tone="warning"
              message="This admin account can view brand settings, but only admins with business-settings access can save changes."
            />
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Business name</span>
              <input
                value={name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                disabled={!canManageBusinessSettings}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                Logo upload
                <InfoHint text="Use a square logo when possible. Recommended size: 512 x 512 pixels. Accepted files: JPG, JPEG, PNG. Max size: 2MB." />
              </span>
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/80 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    onChange={(event) => {
                      if (!canManageBusinessSettings) return;
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setLogoUploadMessage('');
                      uploadTenantLogo.mutate(file, {
                        onSuccess: (upload) => {
                          setDraft((current) => ({ ...current, logoUrl: upload.url }));
                          setLogoUploadMessage('Logo uploaded. Save settings to publish it.');
                        },
                      });
                      event.currentTarget.value = '';
                    }}
                    disabled={!canManageBusinessSettings}
                    className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-brand-button file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-button-strong sm:flex-1"
                  />
                  {uploadTenantLogo.isPending ? (
                    <span className="text-sm text-slate-500">Uploading...</span>
                  ) : null}
                </div>
                {uploadTenantLogo.error ? (
                  <p className="mt-3 text-sm text-rose-600">
                    {getApiErrorMessage(uploadTenantLogo.error, 'Could not upload the logo.')}
                  </p>
                ) : logoUploadMessage ? (
                  <p className="mt-3 text-sm text-emerald-600">{logoUploadMessage}</p>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Recommended: <span className="font-semibold text-slate-700">512 × 512px</span>. Square images keep the portal header looking cleaner.
                  </p>
                )}
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Saved logo URL</span>
              <input
                value={logoUrl}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, logoUrl: event.target.value }))
                }
                disabled={!canManageBusinessSettings}
                placeholder="https://..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              />
              <p className="text-sm text-slate-500">Paste an external URL here, or use the upload button above.</p>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Primary color</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, primaryColor: event.target.value }))
                  }
                  disabled={!canManageBusinessSettings}
                  className="h-8 w-10 rounded-lg border-0 bg-transparent p-0"
                />
                <span className="text-sm text-slate-600">{primaryColor}</span>
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Secondary color</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, accentColor: event.target.value }))
                  }
                  disabled={!canManageBusinessSettings}
                  className="h-8 w-10 rounded-lg border-0 bg-transparent p-0"
                />
                <span className="text-sm text-slate-600">{accentColor}</span>
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Text color</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <input
                  type="color"
                  value={textColor}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, textColor: event.target.value }))
                  }
                  disabled={!canManageBusinessSettings}
                  className="h-8 w-10 rounded-lg border-0 bg-transparent p-0"
                />
                <span className="text-sm text-slate-600">{textColor}</span>
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Button color</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <input
                  type="color"
                  value={buttonColor}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, buttonColor: event.target.value }))
                  }
                  disabled={!canManageBusinessSettings}
                  className="h-8 w-10 rounded-lg border-0 bg-transparent p-0"
                />
                <span className="text-sm text-slate-600">{buttonColor}</span>
              </div>
              <p className="text-sm text-slate-500">Controls the main action buttons across the portal.</p>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Text font style</span>
              <select
                value={fontStyle}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    fontStyle: event.target.value as 'modern' | 'classic' | 'clean',
                  }))
                }
                disabled={!canManageBusinessSettings}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
              >
                {fontStyleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-slate-500">{selectedFont.description}</p>
            </label>
          </div>
        </div>
      </DetailModal>

      {/* Custom domain modal */}
      <DetailModal
        open={openTile === 'domain'}
        onClose={() => setOpenTile(null)}
        title="Custom domain"
        description="Connect and verify a custom domain for this business portal."
        width="xl"
        footer={settingsSaveFooter}
      >
        <div className="space-y-5">
          {!canManageBusinessSettings ? (
            <FeedbackBanner
              tone="warning"
              message="This admin account can review the domain setup, but only admins with business-settings access can save changes."
            />
          ) : null}

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Custom domain</span>
            <input
              value={customDomain}
              onChange={(event) =>
                setDraft((current) => ({ ...current, customDomain: event.target.value }))
              }
              disabled={!canManageBusinessSettings}
              placeholder="portal.yourbusiness.com"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
            />
            <p className="text-sm text-slate-500">
              Changing the domain keeps the saved value but resets verification until the domain is confirmed again.
            </p>
          </label>

          <div className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Custom domain verification</p>
                <p className="mt-1 text-sm text-slate-500">
                  Prove ownership with a DNS TXT record before this domain can go live on ZenDocx.
                </p>
              </div>
              {overview.tenant.customDomainVerified ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Verified
                </span>
              ) : savedCustomDomain ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  Verification pending
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                  No custom domain saved
                </span>
              )}
            </div>

            {!savedCustomDomain ? (
              <FeedbackBanner
                tone="info"
                message="Save a custom domain first. Once saved, this workspace will show the exact DNS TXT record needed for verification."
              />
            ) : verificationError ? (
              <FeedbackBanner
                tone="error"
                title="Verification details unavailable"
                message={verificationError}
              />
            ) : verificationLoading || !verification ? (
              <p className="text-sm text-slate-500">Loading verification instructions...</p>
            ) : (
              <div className="space-y-4">
                <FeedbackBanner
                  tone={domainStatusCopy[verification.verificationStatus].tone}
                  title={domainStatusCopy[verification.verificationStatus].title}
                  message={
                    verification.verificationStatus === 'VERIFIED'
                      ? `The custom domain ${verification.customDomain} is verified and can now be routed safely.`
                      : domainStatusCopy[verification.verificationStatus].message
                  }
                />

                <FeedbackBanner
                  tone={
                    verification.verificationService.dedicatedSecretConfigured
                      ? 'info'
                      : 'warning'
                  }
                  title="Platform operator note"
                  message={verification.verificationService.message}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">TXT record host</span>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={verification.recordHost}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => void copyToClipboard(verification.recordHost, 'TXT host')}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Copy
                      </button>
                    </div>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">TXT record value</span>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={verification.recordValue}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => void copyToClipboard(verification.recordValue, 'TXT value')}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Copy
                      </button>
                    </div>
                  </label>
                </div>

                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">How to verify</p>
                  <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    <li>1. Open your DNS provider for {verification.customDomain}.</li>
                    <li>2. Create a TXT record with the host and value shown above.</li>
                    <li>3. Wait for DNS propagation, then click verify from this page.</li>
                  </ol>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Live DNS diagnostics</p>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                      <p>
                        <span className="font-semibold text-slate-800">Last checked:</span>{' '}
                        {verification.dnsLookup.checkedAt
                          ? formatDate(verification.dnsLookup.checkedAt)
                          : 'Not checked yet'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">Expected value found:</span>{' '}
                        {verification.dnsLookup.expectedValueFound ? 'Yes' : 'No'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">Records found:</span>{' '}
                        {verification.dnsLookup.recordsFound.length}
                      </p>
                      {verification.dnsLookup.errorCode ? (
                        <p>
                          <span className="font-semibold text-slate-800">Lookup error:</span>{' '}
                          {verification.dnsLookup.errorCode}
                          {verification.dnsLookup.errorMessage
                            ? ` — ${verification.dnsLookup.errorMessage}`
                            : ''}
                        </p>
                      ) : null}
                    </div>
                    {verification.dnsLookup.recordsFound.length ? (
                      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Visible TXT values
                        </p>
                        <div className="mt-2 space-y-2">
                          {verification.dnsLookup.recordsFound.map((record) => (
                            <code
                              key={record}
                              className="block overflow-x-auto rounded-xl bg-white px-3 py-2 text-xs text-slate-700"
                            >
                              {record}
                            </code>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Common DNS provider tips</p>
                    <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                      <p>
                        <span className="font-semibold text-slate-800">Cloudflare:</span>{' '}
                        create a DNS-only TXT record. Leave proxying off — TXT records are never proxied.
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">Namecheap:</span>{' '}
                        paste only the host portion exactly as shown. Namecheap usually appends the root domain automatically.
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">GoDaddy:</span>{' '}
                        use the TXT type, paste the full value, and allow a few minutes for propagation before rechecking.
                      </p>
                    </div>
                  </div>
                </div>

                {verifyTenantCustomDomain.error ? (
                  <FeedbackBanner
                    tone="error"
                    message={getApiErrorMessage(
                      verifyTenantCustomDomain.error,
                      'Could not verify the custom domain right now.',
                    )}
                  />
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      verifyTenantCustomDomain.mutate(undefined, {
                        onSuccess: () => {
                          toast.success('Custom domain verified successfully.');
                        },
                      });
                    }}
                    disabled={
                      !canManageBusinessSettings ||
                      verifyTenantCustomDomain.isPending ||
                      overview.tenant.customDomainVerified ||
                      !verification.verificationService.canVerifyReliably
                    }
                    className="rounded-2xl bg-brand-button px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {overview.tenant.customDomainVerified
                      ? 'Domain verified'
                      : verifyTenantCustomDomain.isPending
                        ? 'Verifying domain...'
                        : 'Verify custom domain'}
                  </button>
                  <button
                    type="button"
                    onClick={reloadVerification}
                    disabled={!savedCustomDomain || verificationLoading}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Refresh DNS check
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DetailModal>

      {/* Public homepage experience modal */}
      <DetailModal
        open={openTile === 'homepage'}
        onClose={() => setOpenTile(null)}
        title="Public homepage experience"
        description="First-time visitors see a tenant homepage before sign-in. Returning visitors go straight to login."
        width="xl"
        footer={settingsSaveFooter}
      >
        <div className="space-y-5">
          {!canManageBusinessSettings ? (
            <FeedbackBanner
              tone="warning"
              message="This admin account can review the homepage setup, but only admins with business-settings access can save changes."
            />
          ) : null}

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Homepage layout</span>
            <select
              value={homepageTemplate}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  homepageTemplate: event.target.value as 'spotlight' | 'service-grid' | 'guided-flow',
                }))
              }
              disabled={!canManageBusinessSettings}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
            >
              {homepageTemplateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-slate-500">{homepageTemplateMeta.description}</p>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Homepage headline</span>
            <input
              value={homepageHeading}
              onChange={(event) =>
                setDraft((current) => ({ ...current, homepageHeading: event.target.value }))
              }
              disabled={!canManageBusinessSettings}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Homepage support text</span>
            <textarea
              value={homepageSubheading}
              onChange={(event) =>
                setDraft((current) => ({ ...current, homepageSubheading: event.target.value }))
              }
              disabled={!canManageBusinessSettings}
              rows={3}
              className="w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">About this business portal</span>
            <textarea
              value={homepageAbout}
              onChange={(event) =>
                setDraft((current) => ({ ...current, homepageAbout: event.target.value }))
              }
              disabled={!canManageBusinessSettings}
              rows={4}
              className="w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
            />
          </label>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">Manual service steps</p>
            {safeManualSteps.map((step, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-[1.25rem] border border-slate-200 bg-white p-4 md:grid-cols-[0.9fr_1.1fr]"
              >
                <input
                  value={step.title}
                  onChange={(event) =>
                    setDraft((current) => {
                      const nextSteps = [...safeManualSteps];
                      nextSteps[index] = { ...nextSteps[index], title: event.target.value };
                      return { ...current, homepageManualSteps: nextSteps };
                    })
                  }
                  disabled={!canManageBusinessSettings}
                  placeholder={`Step ${index + 1} title`}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                />
                <textarea
                  value={step.description}
                  onChange={(event) =>
                    setDraft((current) => {
                      const nextSteps = [...safeManualSteps];
                      nextSteps[index] = { ...nextSteps[index], description: event.target.value };
                      return { ...current, homepageManualSteps: nextSteps };
                    })
                  }
                  disabled={!canManageBusinessSettings}
                  placeholder="Describe what the visitor should do in this step"
                  rows={2}
                  className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                />
              </div>
            ))}
          </div>
        </div>
      </DetailModal>

      {/* Portal preview modal */}
      <DetailModal
        open={openTile === 'preview'}
        onClose={() => setOpenTile(null)}
        title="Portal preview"
        description="Live brand preview. Open the portal to see the full customer-facing experience."
        width="lg"
      >
        <div className="space-y-4">
          <div
            className="rounded-[1.75rem] border border-slate-200 p-5 shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)`,
              color: textColor,
              fontFamily: selectedFont.fontFamily,
            }}
          >
            {logoUrl.trim() ? (
              <div className="mb-4 inline-flex rounded-2xl bg-white/85 px-3 py-2 shadow-sm">
                {/* External tenant logos can come from mixed hosts, so a plain img is safer here than next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt={`${name || 'Business'} logo`}
                  className="h-10 w-auto max-w-[8rem] object-contain"
                />
              </div>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">
              Business portal
            </p>
            <h2 className="mt-3 text-2xl font-bold">{name || 'Your business'}</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 opacity-90">
              Sign-in, user management, and service operations are all scoped to this business identity.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                style={{ backgroundColor: buttonColor }}
              >
                Button preview
              </span>
              <a
                href={portalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/30"
              >
                <ExternalLink size={14} />
                Open portal
              </a>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4 text-sm text-slate-600 shadow-sm">
            <p>
              <span className="font-semibold text-slate-800">Portal URL:</span>{' '}
              <a
                href={portalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-navy underline underline-offset-2 transition hover:opacity-70"
              >
                {overview.tenant.customDomainVerified && overview.tenant.customDomain
                  ? overview.tenant.customDomain
                  : `?tenant=${overview.tenant.slug}`}
              </a>
            </p>
            <p className="mt-2">
              <span className="font-semibold text-slate-800">Domain:</span>{' '}
              {customDomain.trim() || 'Not connected yet'}
            </p>
            <p className="mt-2">
              <span className="font-semibold text-slate-800">Font:</span>{' '}
              {selectedFont.label}
            </p>
          </div>
        </div>
      </DetailModal>

      {/* Business admin access modal */}
      <DetailModal
        open={openTile === 'admins'}
        onClose={() => setOpenTile(null)}
        title="Business admin access"
        description="Business admins can be created and scoped here. Individual customers are on the users page, and CBT centers stay on the CBT page."
        width="xl"
      >
        <div className="space-y-5">
          {!canManageBusinessAdmins ? (
            <FeedbackBanner
              tone="warning"
              message="This admin account can review who has business access, but only admins with business-admin permissions can create, edit, or remove those accounts."
            />
          ) : null}

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-slate-900">Add another business admin</p>
              <p className="text-sm text-slate-500">
                Create a second or third admin only when the business truly needs shared operational control.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input
                value={newAdmin.firstName}
                onChange={(event) =>
                  setNewAdmin((current) => ({ ...current, firstName: event.target.value }))
                }
                disabled={!canManageBusinessAdmins}
                placeholder="First name"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              />
              <input
                value={newAdmin.lastName}
                onChange={(event) =>
                  setNewAdmin((current) => ({ ...current, lastName: event.target.value }))
                }
                disabled={!canManageBusinessAdmins}
                placeholder="Last name"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              />
              <input
                value={newAdmin.email}
                onChange={(event) =>
                  setNewAdmin((current) => ({ ...current, email: event.target.value }))
                }
                disabled={!canManageBusinessAdmins}
                placeholder="Email address"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              />
              <input
                value={newAdmin.phone}
                onChange={(event) =>
                  setNewAdmin((current) => ({ ...current, phone: event.target.value }))
                }
                disabled={!canManageBusinessAdmins}
                placeholder="Phone number"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              />
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-slate-900">Permission scope</p>
              <div className="grid gap-3 md:grid-cols-2">
                {TENANT_ADMIN_PERMISSIONS.map((permission) => {
                  const meta = tenantAdminPermissionLabels[permission];
                  const checked = newAdmin.permissions.includes(permission);
                  return (
                    <label
                      key={permission}
                      className="flex gap-3 rounded-[1.25rem] border border-slate-200 bg-white p-4"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canManageBusinessAdmins}
                        onChange={() =>
                          setNewAdmin((current) => ({
                            ...current,
                            permissions: checked
                              ? current.permissions.filter((item) => item !== permission)
                              : [...current.permissions, permission],
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-button focus:ring-brand-button"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{meta.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {createTenantAdmin.error ? (
              <div className="mt-4">
                <FeedbackBanner
                  tone="error"
                  message={getApiErrorMessage(
                    createTenantAdmin.error,
                    'Could not create the business admin right now.',
                  )}
                />
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={createTenantAdmin.isPending || !canManageBusinessAdmins}
                onClick={() => {
                  createTenantAdmin.mutate(newAdmin, {
                    onSuccess: (created) => {
                      toast.success(
                        `Business admin created. Login email: ${created.email}. Temporary password: ${created.tempPassword}`,
                        { duration: 8000 },
                      );
                      setNewAdmin({
                        firstName: '',
                        lastName: '',
                        email: '',
                        phone: '',
                        permissions: [...TENANT_ADMIN_PERMISSIONS],
                      });
                    },
                  });
                }}
                className="rounded-2xl bg-brand-button px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createTenantAdmin.isPending ? 'Creating...' : 'Create business admin'}
              </button>
            </div>
          </div>

          {tenantAdminsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-24 rounded-[1.5rem]" />
              ))}
            </div>
          ) : tenantAdminsError ? (
            <FeedbackBanner tone="error" message={tenantAdminsError} />
          ) : tenantAdmins.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {tenantAdmins.map((admin) => {
                const adminPermissions = admin.adminPermissions ?? [];
                const isCurrentAdmin = currentUser?.id === admin.id;

                return (
                  <article
                    key={admin.id}
                    className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">
                          {admin.firstName} {admin.lastName}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">{admin.email}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                        {isCurrentAdmin ? 'Current admin' : 'Business admin'}
                      </span>
                    </div>

                    <dl className="mt-4 space-y-2 text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-4">
                        <dt>Phone</dt>
                        <dd>{admin.phone}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt>Status</dt>
                        <dd>{admin.isActive ? 'Active' : 'Paused'}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt>Joined</dt>
                        <dd>{formatDate(admin.createdAt)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt>Last sign-in</dt>
                        <dd>{admin.lastLoginAt ? formatDate(admin.lastLoginAt) : 'Not yet'}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Permissions
                      </p>
                      <div className="grid gap-2">
                        {TENANT_ADMIN_PERMISSIONS.map((permission) => (
                          <label
                            key={permission}
                            className="flex items-start gap-3 rounded-[1rem] border border-slate-200 bg-white px-3 py-3"
                          >
                            <input
                              type="checkbox"
                              checked={adminPermissions.includes(permission)}
                              disabled={!canManageBusinessAdmins || isCurrentAdmin}
                              onChange={() => {
                                const nextPermissions = adminPermissions.includes(permission)
                                  ? adminPermissions.filter((item) => item !== permission)
                                  : [...adminPermissions, permission];

                                updateTenantAdmin.mutate(
                                  { userId: admin.id, permissions: nextPermissions },
                                  {
                                    onSuccess: () => {
                                      toast.success('Business admin permissions updated.');
                                    },
                                  },
                                );
                              }}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-button focus:ring-brand-button"
                            />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {tenantAdminPermissionLabels[permission].label}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {tenantAdminPermissionLabels[permission].description}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={!canManageBusinessAdmins || isCurrentAdmin || updateTenantAdmin.isPending}
                        onClick={() => {
                          updateTenantAdmin.mutate(
                            { userId: admin.id, isActive: !admin.isActive },
                            {
                              onSuccess: () => {
                                toast.success(
                                  admin.isActive
                                    ? 'Business admin paused.'
                                    : 'Business admin reactivated.',
                                );
                              },
                            },
                          );
                        }}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {admin.isActive ? 'Pause access' : 'Restore access'}
                      </button>
                      <button
                        type="button"
                        disabled={!canManageBusinessAdmins || isCurrentAdmin || deleteTenantAdmin.isPending}
                        onClick={() => {
                          deleteTenantAdmin.mutate(admin.id, {
                            onSuccess: () => {
                              toast.success('Business admin removed.');
                            },
                          });
                        }}
                        className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Remove admin
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No business admins found"
              message="Business-admin accounts provisioned for this tenant will appear here."
            />
          )}
        </div>
      </DetailModal>
    </div>
  );
}

function DashTile({ icon: Icon, label, value, color, onClick }: {
  icon: ElementType; label: string; value: string; color: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:shadow-sm active:scale-[0.98]"
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${color}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">{value}</p>
      </div>
    </button>
  );
}
