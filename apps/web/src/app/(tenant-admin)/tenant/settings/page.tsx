'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  TENANT_ADMIN_PERMISSIONS,
  type TenantAdminPermission,
  UserRole,
} from '@zendocx/types';
import {
  useCreateTenantAdmin,
  useDeleteTenantAdmin,
  useTenantOverview,
  useTenantUsers,
  useUpdateTenantAdmin,
  useUpdateTenantSettings,
  useUploadTenantLogo,
} from '@/hooks/use-tenant-admin';
import { AccountPanel } from '@/components/shared/account-panel';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { PageHero } from '@/components/shared/page-hero';
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

export default function TenantSettingsPage() {
  const currentUser = useAuthStore((state) => state.user);
  const { overview, loading, error, reload } = useTenantOverview();
  const updateTenantSettings = useUpdateTenantSettings();
  const uploadTenantLogo = useUploadTenantLogo();
  const createTenantAdmin = useCreateTenantAdmin();
  const updateTenantAdmin = useUpdateTenantAdmin();
  const deleteTenantAdmin = useDeleteTenantAdmin();

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
  const [successMessage, setSuccessMessage] = useState('');
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

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <SkeletonBlock className="h-44 rounded-[2rem]" />
        <SkeletonBlock className="h-[32rem] rounded-[2rem]" />
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

  const name = draft.name ?? overview.tenant.name;
  const logoUrl = draft.logoUrl ?? overview.tenant.logoUrl ?? '';
  const customDomain = draft.customDomain ?? overview.tenant.customDomain ?? '';
  const primaryColor = draft.primaryColor ?? overview.tenant.primaryColor;
  const accentColor = draft.accentColor ?? overview.tenant.accentColor;
  const textColor = draft.textColor ?? overview.tenant.textColor;
  const buttonColor = draft.buttonColor ?? overview.tenant.buttonColor;
  const fontStyle = (draft.fontStyle ??
    overview.tenant.fontStyle) as 'modern' | 'classic' | 'clean';
  const homepageTemplate = (draft.homepageTemplate ??
    overview.tenant.homepageTemplate) as 'spotlight' | 'service-grid' | 'guided-flow';
  const homepageHeading =
    draft.homepageHeading ?? overview.tenant.homepageHeading ?? '';
  const homepageSubheading =
    draft.homepageSubheading ?? overview.tenant.homepageSubheading ?? '';
  const homepageAbout =
    draft.homepageAbout ?? overview.tenant.homepageAbout ?? '';
  const homepageManualSteps =
    draft.homepageManualSteps ?? overview.tenant.homepageManualSteps;
  const selectedFont =
    fontStyleOptions.find((option) => option.value === fontStyle) ??
    fontStyleOptions[0];
  const homepageTemplateMeta =
    homepageTemplateOptions.find((option) => option.value === homepageTemplate) ??
    homepageTemplateOptions[0];
  const safeManualSteps = useMemo(() => {
    const steps = homepageManualSteps.length
      ? homepageManualSteps
      : [emptyStep, emptyStep, emptyStep];
    return Array.from({ length: 3 }, (_, index) => steps[index] ?? emptyStep);
  }, [homepageManualSteps]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHero
        eyebrow="Business settings"
        title="Shape how this business portal looks and who manages it"
        description="Business admins can control the visible brand for this tenant here. Individual users stay on the users page, CBT centers stay on the CBT page, and business-admin access is shown in this settings workspace."
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Brand identity
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Adjust the logo, colors, and type feel here so the business portal is visually distinct from the platform owner workspace.
          </p>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-amber-50/70 to-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Admin ownership
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Business-admin accounts live in this settings page so customer and CBT directories stay focused on their own roles.
          </p>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200 bg-gradient-to-br from-emerald-50/70 to-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Portal preview
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The preview on this page helps you sanity-check the business look before customers and CBT centers see it.
          </p>
        </article>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <AccountPanel
          title="Brand and portal details"
          description="These settings control the logo, colors, and text style people see throughout this business portal."
        >
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canManageBusinessSettings) {
                return;
              }
              setSuccessMessage('');

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
                    setSuccessMessage('Tenant settings updated.');
                  },
                },
              );
            }}
          >
            {successMessage ? (
              <FeedbackBanner tone="success" message={successMessage} />
            ) : null}

            {updateTenantSettings.error ? (
              <FeedbackBanner
                tone="error"
                message={getApiErrorMessage(
                  updateTenantSettings.error,
                  'Could not update tenant settings right now.',
                )}
              />
            ) : null}

            {!canManageBusinessSettings ? (
              <FeedbackBanner
                tone="warning"
                message="This business admin account can review the homepage and brand setup, but only admins with business-settings access can save changes."
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
                        if (!canManageBusinessSettings) {
                          return;
                        }
                        const file = event.target.files?.[0];
                        if (!file) {
                          return;
                        }

                        setSuccessMessage('');
                        uploadTenantLogo.mutate(file, {
                          onSuccess: (upload) => {
                            setDraft((current) => ({ ...current, logoUrl: upload.url }));
                            setSuccessMessage('Logo uploaded. Save settings to publish it across the portal.');
                          },
                        });
                        event.currentTarget.value = '';
                      }}
                      disabled={!canManageBusinessSettings}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-brand-button file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-button-strong sm:flex-1"
                    />
                    {uploadTenantLogo.isPending ? (
                      <span className="text-sm text-slate-500">Uploading logo...</span>
                    ) : null}
                  </div>
                  {uploadTenantLogo.error ? (
                    <p className="mt-3 text-sm text-rose-600">
                      {getApiErrorMessage(
                        uploadTenantLogo.error,
                        'Could not upload the logo right now.',
                      )}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      Recommended size: <span className="font-semibold text-slate-700">512 x 512px</span>. A square image keeps the portal header and cards looking cleaner.
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
                <p className="text-sm text-slate-500">
                  You can paste an external logo URL here too, but the upload button above is the safest option.
                </p>
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
                <p className="text-sm text-slate-500">
                  This controls the main action buttons business users see across the portal.
                </p>
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

            <div className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Public homepage experience
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  First-time visitors should land on a tenant homepage before they see sign-in. Returning visitors can go straight to login.
                </p>
              </div>

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
                    setDraft((current) => ({
                      ...current,
                      homepageHeading: event.target.value,
                    }))
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
                    setDraft((current) => ({
                      ...current,
                      homepageSubheading: event.target.value,
                    }))
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
                    setDraft((current) => ({
                      ...current,
                      homepageAbout: event.target.value,
                    }))
                  }
                  disabled={!canManageBusinessSettings}
                  rows={4}
                  className="w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                />
              </label>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">
                  Manual service steps
                </p>
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
                          nextSteps[index] = {
                            ...nextSteps[index],
                            title: event.target.value,
                          };
                          return {
                            ...current,
                            homepageManualSteps: nextSteps,
                          };
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
                          nextSteps[index] = {
                            ...nextSteps[index],
                            description: event.target.value,
                          };
                          return {
                            ...current,
                            homepageManualSteps: nextSteps,
                          };
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

            <button
              type="submit"
              disabled={updateTenantSettings.isPending || !canManageBusinessSettings}
              className="rounded-2xl bg-brand-button px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-button-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updateTenantSettings.isPending ? 'Saving changes...' : 'Save settings'}
            </button>
          </form>
        </AccountPanel>

        <AccountPanel
          title="Portal preview"
          description="A quick view of what people will recognize when they enter this business portal."
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
                  <Image
                    src={logoUrl}
                    alt={`${name || 'Business'} logo`}
                    width={128}
                    height={40}
                    className="h-10 w-auto max-w-[8rem] object-contain"
                    unoptimized
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
              <button
                type="button"
                className="mt-5 inline-flex items-center rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition"
                style={{ backgroundColor: buttonColor }}
              >
                Main business button preview
              </button>
            </div>

            <div className="rounded-[1.5rem] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4 text-sm text-slate-600 shadow-sm">
              <p>
                <span className="font-semibold text-slate-800">Portal slug:</span>{' '}
                {overview.tenant.slug}
              </p>
              <p className="mt-2">
                <span className="font-semibold text-slate-800">Current domain:</span>{' '}
                {customDomain.trim() || 'Not connected yet'}
              </p>
              <p className="mt-2">
                <span className="font-semibold text-slate-800">Logo:</span>{' '}
                {logoUrl.trim() || 'No logo URL saved yet'}
              </p>
              <p className="mt-2">
                <span className="font-semibold text-slate-800">Text color:</span>{' '}
                {textColor}
              </p>
              <p className="mt-2">
                <span className="font-semibold text-slate-800">Button color:</span>{' '}
                {buttonColor}
              </p>
              <p className="mt-2">
                <span className="font-semibold text-slate-800">Font style:</span>{' '}
                {selectedFont.label}
              </p>
            </div>
          </div>
        </AccountPanel>
      </div>

      <AccountPanel
        title="Business admin access"
        description="Business admins can be created and scoped here. Individual customers are on the users page, and CBT centers stay on the CBT page."
      >
        <div className="space-y-5">
          {!canManageBusinessAdmins ? (
            <FeedbackBanner
              tone="warning"
              message="This business admin account can review who has business access, but only admins with business-admin permissions can create, edit, or remove those accounts."
            />
          ) : null}

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-slate-900">
                Add another business admin
              </p>
              <p className="text-sm text-slate-500">
                Create a second or third admin only when the business truly needs shared operational control.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input
                value={newAdmin.firstName}
                onChange={(event) =>
                  setNewAdmin((current) => ({
                    ...current,
                    firstName: event.target.value,
                  }))
                }
                disabled={!canManageBusinessAdmins}
                placeholder="First name"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              />
              <input
                value={newAdmin.lastName}
                onChange={(event) =>
                  setNewAdmin((current) => ({
                    ...current,
                    lastName: event.target.value,
                  }))
                }
                disabled={!canManageBusinessAdmins}
                placeholder="Last name"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              />
              <input
                value={newAdmin.email}
                onChange={(event) =>
                  setNewAdmin((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                disabled={!canManageBusinessAdmins}
                placeholder="Email address"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              />
              <input
                value={newAdmin.phone}
                onChange={(event) =>
                  setNewAdmin((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                disabled={!canManageBusinessAdmins}
                placeholder="Phone number"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
              />
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                Permission scope
              </p>
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
                        <p className="text-sm font-semibold text-slate-900">
                          {meta.label}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {meta.description}
                        </p>
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
                {createTenantAdmin.isPending
                  ? 'Creating business admin...'
                  : 'Create business admin'}
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
                                  {
                                    userId: admin.id,
                                    permissions: nextPermissions,
                                  },
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
                            {
                              userId: admin.id,
                              isActive: !admin.isActive,
                            },
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
      </AccountPanel>
    </div>
  );
}
