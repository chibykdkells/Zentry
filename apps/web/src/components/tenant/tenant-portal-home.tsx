'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileStack, ShieldCheck } from 'lucide-react';
import { useTenantStore } from '@/stores/tenant.store';
import { appendTenantContextToPath } from '@/lib/tenant-runtime';
import { useServiceCatalog } from '@/hooks/use-service-catalog';

interface TenantPortalHomeProps {
  tenantSlug: string;
}

export function TenantPortalHome({ tenantSlug }: TenantPortalHomeProps) {
  const tenant = useTenantStore((state) => state.tenant);
  const { services, loading } = useServiceCatalog({});

  const brandName = tenant?.name ?? 'This business';
  const heading =
    tenant?.homepageHeading ?? `Access ${brandName} from one business portal`;
  const subheading =
    tenant?.homepageSubheading ??
    'Review services, understand the process, and continue when you are ready.';
  const about =
    tenant?.homepageAbout ??
    `${brandName} uses ZenDocx to manage customer requests, service operations, and manual document processing from one place.`;
  const steps = tenant?.homepageManualSteps?.length
    ? tenant.homepageManualSteps
    : [
        {
          title: 'Choose a service',
          description:
            'Review the available services and pick the request you need before continuing.',
        },
        {
          title: 'Create or use your account',
          description:
            'Sign in or get started so the request stays tied to your business portal account.',
        },
        {
          title: 'Track progress',
          description:
            'Follow updates until the manual processing is complete and the result is ready.',
        },
      ];

  const visibleServices = services.slice(0, 8);
  const loginHref = appendTenantContextToPath('/login', tenantSlug);
  const registerHref = appendTenantContextToPath('/register', tenantSlug);

  const template = tenant?.homepageTemplate ?? 'spotlight';

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef3fb_0%,#f8fbff_46%,#ffffff_100%)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[2.3rem] border border-white/60 bg-white/92 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="bg-[linear-gradient(160deg,var(--brand-navy)_0%,var(--brand-button)_52%,#10203c_100%)] px-6 py-8 text-white sm:px-8 sm:py-10">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
                <ShieldCheck size={14} className="text-brand-accent" />
                {brandName}
              </div>
              <h1 className="mt-6 max-w-xl text-[2.6rem] font-black leading-[0.96] tracking-[-0.05em] sm:text-[3.3rem]">
                {heading}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-200">
                {subheading}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={registerHref}
                  className="inline-flex items-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-brand-navy transition hover:bg-slate-100"
                >
                  Get started
                </Link>
                <Link
                  href={loginHref}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
                >
                  Login
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="px-6 py-8 sm:px-8 sm:py-10">
              {template === 'guided-flow' ? (
                <div className="space-y-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Manual document process
                  </p>
                  {steps.map((step, index) => (
                    <div
                      key={`${step.title}-${index}`}
                      className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">
                        Step {index + 1}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {step.title}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-500">
                        {step.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    About this business portal
                  </p>
                  <p className="text-base leading-8 text-slate-600">{about}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {steps.map((step, index) => (
                      <div
                        key={`${step.title}-${index}`}
                        className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4"
                      >
                        <div className="flex items-center gap-2 text-brand-navy">
                          <CheckCircle2 size={16} />
                          <span className="text-sm font-semibold">
                            {step.title}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {step.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-navy/8 text-brand-navy">
                <FileStack size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                  How to use manual processing
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                  Clear first steps
                </h2>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {steps.map((step, index) => (
                <div
                  key={`${step.title}-${index}-detail`}
                  className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">
                    Step {index + 1}
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {step.title}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Available services
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                  What this business currently offers
                </h2>
              </div>
              <Link
                href={registerHref}
                className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
              >
                Get started
              </Link>
            </div>

            <div
              className={
                template === 'service-grid'
                  ? 'mt-6 grid gap-3 sm:grid-cols-2'
                  : 'mt-6 space-y-3'
              }
            >
              {loading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-24 animate-pulse rounded-[1.35rem] bg-slate-100"
                    />
                  ))
                : visibleServices.map((service) => (
                    <div
                      key={service.id}
                      className="rounded-[1.35rem] border border-slate-200 bg-slate-50/60 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900">
                            {service.name}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {service.category.name}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                          {service.totalPrice}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        {service.description ??
                          'This service is available in the business portal and can be requested after sign-in.'}
                      </p>
                    </div>
                  ))}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
