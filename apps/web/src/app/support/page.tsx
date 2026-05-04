'use client';

import Link from 'next/link';
import { MessageSquareWarning } from 'lucide-react';
import { ProtectedShell } from '@/components/layout/protected-shell';
import { AccountPanel } from '@/components/shared/account-panel';
import { PageHeader } from '@/components/shared/page-header';
import { ScrollCardBody } from '@/components/shared/scroll-card-body';
import {
  supportChannels,
  supportFaqs,
  supportQuickActions,
} from '@/lib/support-content';

export default function SupportPage() {
  return (
    <ProtectedShell title="Support">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:flex md:h-full md:flex-col md:p-8 xl:overflow-hidden">
        <PageHeader
          title="Support"
          description="Find help, recovery guidance, and next steps."
          actions={
            <Link
              href="/disputes"
              className="inline-flex items-center justify-center rounded-2xl border border-brand-line bg-brand-surface px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:shadow-sm"
            >
              Disputes
            </Link>
          }
        />

        <section className="grid gap-4 lg:grid-cols-3">
          {supportQuickActions.map((action) => (
            <article
              key={action.title}
              className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-[#0D1B3E]">
                <action.icon size={20} />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                {action.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {action.description}
              </p>
              <Link
                href={action.href}
                className="mt-5 inline-flex items-center rounded-2xl bg-[#0D1B3E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#132754]"
              >
                {action.cta}
              </Link>
            </article>
          ))}
        </section>

        <div className="grid gap-6 xl:min-h-0 xl:flex-1 xl:grid-cols-[1.1fr_0.9fr] xl:overflow-hidden">
          <AccountPanel
            title="Common questions"
            description="A focused help center for the workflows already available inside the app."
            contentClassName="xl:min-h-0"
          >
            <ScrollCardBody bodyClassName="space-y-3" maxHeightClassName="xl:min-h-0 xl:flex-1">
              {supportFaqs.map((faq) => (
                <article
                  key={faq.question}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-slate-200 hover:bg-white"
                >
                  <h3 className="text-sm font-semibold text-slate-900">
                    {faq.question}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {faq.answer}
                  </p>
                </article>
              ))}
            </ScrollCardBody>
          </AccountPanel>

          <AccountPanel
            title="Support model"
            description="This explains how the platform is being shaped to help users before live support tooling arrives."
            contentClassName="xl:min-h-0"
          >
            <ScrollCardBody bodyClassName="space-y-4" maxHeightClassName="xl:min-h-0 xl:flex-1">
              {supportChannels.map((channel) => (
                <div
                  key={channel.title}
                  className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-slate-200 hover:bg-white"
                >
                  <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#0D1B3E] shadow-sm">
                    <channel.icon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {channel.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {channel.description}
                    </p>
                  </div>
                </div>
              ))}
            </ScrollCardBody>
          </AccountPanel>
        </div>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Still need a path forward?
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                If your issue is tied to fulfillment quality, payment timing, or
                order completion, the dispute workspace is the next place to
                look.
              </p>
            </div>
            <Link
              href="/disputes"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#0D1B3E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#132754]"
            >
              Review dispute readiness
              <MessageSquareWarning size={16} />
            </Link>
          </div>
        </section>
      </div>
    </ProtectedShell>
  );
}
