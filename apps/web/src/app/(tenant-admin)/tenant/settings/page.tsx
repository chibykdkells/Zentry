'use client';

import Image from 'next/image';
import { useState } from 'react';
import { UserRole } from '@zendocx/types';
import {
  useTenantOverview,
  useTenantUsers,
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

export default function TenantSettingsPage() {
  const { overview, loading, error, reload } = useTenantOverview();
  const updateTenantSettings = useUpdateTenantSettings();
  const uploadTenantLogo = useUploadTenantLogo();

  const [draft, setDraft] = useState<{
    name?: string;
    logoUrl?: string;
    customDomain?: string;
    primaryColor?: string;
    accentColor?: string;
    textColor?: string;
    buttonColor?: string;
    fontStyle?: 'modern' | 'classic' | 'clean';
  }>({});
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
  const selectedFont =
    fontStyleOptions.find((option) => option.value === fontStyle) ??
    fontStyleOptions[0];

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

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Business name</span>
                <input
                  value={name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
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
                placeholder="portal.yourbusiness.com"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#0D1B3E] focus:ring-2 focus:ring-[#0D1B3E]/10"
              />
              <p className="text-sm text-slate-500">
                Changing the domain keeps the saved value but resets verification until the domain is confirmed again.
              </p>
            </label>

            <button
              type="submit"
              disabled={updateTenantSettings.isPending}
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
        description="This section shows the business-admin accounts for this tenant. Individual customers are on the users page, and CBT centers stay on the CBT page."
      >
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
            {tenantAdmins.map((admin) => (
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
                    Business admin
                  </span>
                </div>

                <dl className="mt-4 space-y-2 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-4">
                    <dt>Phone</dt>
                    <dd>{admin.phone}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt>Email</dt>
                    <dd>{admin.isEmailVerified ? 'Verified' : 'Pending'}</dd>
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
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No business admins found"
            message="Business-admin accounts provisioned for this tenant will appear here."
          />
        )}
      </AccountPanel>
    </div>
  );
}
