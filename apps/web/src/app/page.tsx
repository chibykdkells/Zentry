import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AccountPanel } from '@/components/shared/account-panel';
import {
  landingAudienceCards,
  landingFeatureCards,
  landingServiceAreas,
} from '@/lib/landing-content';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
      <div className="w-full space-y-8">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          <div className="grid gap-10 px-6 py-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-10">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0D1B3E] font-black text-amber-400">
                  Z
                </span>
                Zentry
              </div>

              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Government Services Platform
                </p>
                <h1 className="max-w-3xl text-4xl font-black tracking-tight text-[#0D1B3E] sm:text-5xl lg:text-6xl">
                  A calmer way to access services, manage requests, and keep operations moving.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                  Zentry brings individuals, approved CBT centers, tenant-run
                  business portals, and platform admins into one clear workspace
                  for identity support, exam services, airtime, data, and
                  wallet-based transactions.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  className="inline-flex items-center justify-center rounded-2xl bg-[#0D1B3E] px-6 py-3 font-semibold text-white transition hover:bg-[#132754]"
                  href="/login"
                >
                  Sign in
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  href="/register"
                >
                  Create an account
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {landingFeatureCards.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <Icon size={18} className="text-[#0D1B3E]" />
                      </div>
                      <p className="mt-4 text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <AccountPanel
              className="border-slate-200 bg-slate-50 shadow-none"
              title="Choose the right entry point"
              description="Regular users sign up directly. CBT centers have dedicated onboarding, while tenant business admins are provisioned into their branded portal."
            >
              <div className="space-y-3">
                {landingAudienceCards.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-start gap-4 rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5 transition hover:border-slate-300 hover:shadow-sm"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0D1B3E]">
                        <Icon size={20} className="text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                        <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#0D1B3E]">
                          {item.cta}
                          <ArrowRight
                            size={16}
                            className="transition group-hover:translate-x-0.5"
                          />
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </AccountPanel>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <AccountPanel
            title="Services covered"
            description="The platform is open to everyday users as well as fulfillment and business operators."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {landingServiceAreas.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </AccountPanel>

          <AccountPanel
            title="What Phase 1 already supports"
            description="The platform foundation is already in place, and the next layers build on top of this base."
          >
            <div className="space-y-4">
              {[
                'Secure sign-in, registration, email verification, password reset, and wallet PIN flows are already wired.',
                'Dedicated workspaces exist for individuals, CBT centers, tenant admins, and platform admins.',
                'Wallet, services, orders, support, notifications, disputes, and role-based navigation are all scaffolded.',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600"
                >
                  {item}
                </div>
              ))}
            </div>
          </AccountPanel>
        </section>
      </div>
    </main>
  );
}
