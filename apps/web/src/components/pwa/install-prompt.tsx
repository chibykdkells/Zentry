/* eslint-disable @next/next/no-img-element */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Share2, Smartphone, X } from 'lucide-react';
import { useHydrated } from '@/hooks/use-hydrated';
import { useTenantStore } from '@/stores/tenant.store';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const DEV_BROWSER_RESET_KEY = 'zendocx-dev-browser-reset-v1';

function getDismissKey(tenantSlug?: string | null) {
  return `zendocx-pwa-install-dismissed-at:${tenantSlug ?? 'platform'}`;
}

function getDismissedState(tenantSlug?: string | null) {
  if (typeof window === 'undefined') {
    return false;
  }

  const dismissedAt = window.localStorage.getItem(getDismissKey(tenantSlug));
  return Boolean(
    dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION_MS,
  );
}

function getInitialInstalledState() {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator &&
      Boolean(
        (window.navigator as Navigator & { standalone?: boolean }).standalone,
      ))
  );
}

function getUserAgent() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.navigator.userAgent;
}

function isLocalDevelopmentHostname(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

function buildTenantManifestUrl(tenant: {
  name: string;
  slug: string;
  primaryColor: string;
  accentColor: string;
  iconUrl?: string | null;
}) {
  const params = new URLSearchParams({
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    primaryColor: tenant.primaryColor,
    accentColor: tenant.accentColor,
  });
  if (tenant.iconUrl) params.set('iconUrl', tenant.iconUrl);

  return `/pwa/manifest?${params.toString()}`;
}

function buildTenantIconUrl(tenant: {
  name: string;
  primaryColor: string;
  accentColor: string;
}) {
  const params = new URLSearchParams({
    tenantName: tenant.name,
    primaryColor: tenant.primaryColor,
    accentColor: tenant.accentColor,
    size: '192',
  });

  return `/pwa/icon?${params.toString()}`;
}

export function InstallPrompt() {
  const tenant = useTenantStore((state) => state.tenant);
  const hydrated = useHydrated();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(getInitialInstalledState);
  const [dismissedOverrides, setDismissedOverrides] = useState<
    Record<string, boolean>
  >({});
  const [isIos] = useState(() => /iPhone|iPad|iPod/i.test(getUserAgent()));
  const [isSafari] = useState(
    () =>
      /Safari/i.test(getUserAgent()) &&
      !/Chrome|CriOS|Edg|FxiOS/i.test(getUserAgent()),
  );

  const tenantSlug = tenant?.slug ?? null;
  const dismissKey = getDismissKey(tenantSlug);
  const isDismissed =
    dismissedOverrides[dismissKey] ??
    (hydrated ? getDismissedState(tenantSlug) : false);
  const appName = tenant?.name?.trim() || 'ZenDocx';
  const appInitial = appName.charAt(0).toUpperCase() || 'Z';
  const tenantLogoUrl = tenant?.logoUrl?.trim() || null;
  const installDescription = deferredPrompt
    ? `Add ${appName} to your home screen for a faster, app-like experience.`
    : `On iPhone or iPad, use Safari's Share menu and choose "Add to Home Screen" for ${appName}.`;

  function dismissPrompt(persist = true) {
    setDismissedOverrides((current) => ({
      ...current,
      [dismissKey]: true,
    }));
    if (persist && typeof window !== 'undefined') {
      window.localStorage.setItem(dismissKey, Date.now().toString());
    }
  }

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const manifestLink = document.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]',
    );
    const appleTouchIconLink = document.querySelector<HTMLLinkElement>(
      'link[rel="apple-touch-icon"]',
    );

    if (!manifestLink && !appleTouchIconLink) {
      return;
    }

    const defaultManifestHref = '/manifest.json';
    const nextManifestHref =
      tenant?.slug && tenant.primaryColor && tenant.accentColor
        ? buildTenantManifestUrl({
            name: tenant.name,
            slug: tenant.slug,
            primaryColor: tenant.primaryColor,
            accentColor: tenant.accentColor,
          })
        : defaultManifestHref;

    const nextAppleIconHref =
      tenant?.slug && tenant.primaryColor && tenant.accentColor
        ? buildTenantIconUrl({
            name: tenant.name,
            primaryColor: tenant.primaryColor,
            accentColor: tenant.accentColor,
          })
        : '/icons/icon-192.png';

    if (manifestLink) {
      manifestLink.href = nextManifestHref;
    }

    if (appleTouchIconLink) {
      appleTouchIconLink.href = nextAppleIconHref;
    }
  }, [tenant]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (
      process.env.NODE_ENV === 'development' &&
      'serviceWorker' in navigator &&
      isLocalDevelopmentHostname(window.location.hostname)
    ) {
      const hasResetBrowserThisTab =
        window.sessionStorage.getItem(DEV_BROWSER_RESET_KEY) === 'done';

      void Promise.all([
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(
              registrations.map((registration) => registration.unregister()),
            ).then((results) =>
              results.some((wasUnregistered) => wasUnregistered),
            ),
          ),
        'caches' in window
          ? window.caches
              .keys()
              .then((cacheNames) =>
                Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName))).then(
                  (results) => results.some(Boolean),
                ),
              )
          : Promise.resolve(false),
      ])
        .then(([hadServiceWorkers, hadCaches]) => {
          if (hasResetBrowserThisTab) {
            return;
          }

          window.sessionStorage.setItem(DEV_BROWSER_RESET_KEY, 'done');
          // In development, silently clear stale PWA state without forcing a browser
          // reload. Automatic reloads can create fast refresh loops in real sessions
          // when the browser repeatedly observes old caches or registrations.
          void hadServiceWorkers;
          void hadCaches;
        })
        .catch(() => undefined);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setDismissedOverrides((current) => ({
        ...current,
        [dismissKey]: true,
      }));
    };

    window.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstallPrompt as EventListener,
    );
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt as EventListener,
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [dismissKey]);

  const showInstallPrompt = useMemo(() => {
    if (isInstalled || isDismissed) {
      return false;
    }

    return Boolean(deferredPrompt) || (isIos && isSafari);
  }, [deferredPrompt, isDismissed, isInstalled, isIos, isSafari]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;

    if (result.outcome === 'accepted') {
      dismissPrompt(false);
      setDeferredPrompt(null);
      return;
    }

    dismissPrompt();
  };

  if (!showInstallPrompt) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md rounded-[1.75rem] border border-brand-line bg-brand-surface p-5 shadow-2xl shadow-slate-300/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-navy text-brand-accent">
              {tenantLogoUrl ? (
                <img
                  src={tenantLogoUrl}
                  alt={appName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-lg font-black text-brand-accent">
                  {appInitial}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-brand-ink">
                Install {appName}
              </h3>
              <p className="mt-1 text-sm leading-6 text-brand-muted">
                {installDescription}
              </p>
              {process.env.NODE_ENV === 'development' ? (
                <p className="mt-2 text-xs text-slate-400">
                  Install prompts only appear reliably from a production build or deployed app.
                </p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => dismissPrompt()}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Dismiss install prompt"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {deferredPrompt ? (
            <button
              type="button"
              onClick={() => {
                void handleInstall();
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-navy-strong"
            >
              {deferredPrompt ? <Download size={16} /> : <Smartphone size={16} />}
              Install app
            </button>
          ) : (
            <div className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-brand-line bg-brand-surface-soft px-4 py-3 text-sm font-semibold text-slate-700">
              <Share2 size={16} />
              Open Share menu
            </div>
          )}

          <button
            type="button"
            onClick={() => dismissPrompt()}
            className="inline-flex flex-1 items-center justify-center rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-brand-surface-soft"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
