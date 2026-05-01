import { ShieldAlert } from 'lucide-react';

const reasonCopy: Record<string, { title: string; description: string }> = {
  'tenant-link': {
    title: 'A tenant portal link is required',
    description:
      'This sign-in path only works when it comes from a business portal URL shared by the tenant. Ask the business that invited you to send the exact portal link again.',
  },
  'platform-link': {
    title: 'Use the platform admin link instead',
    description:
      'This page is not a valid public entry point. Platform owners should use the dedicated platform admin link shared internally, while tenant users should return to their business portal URL.',
  },
};

export default async function AccessRequiredPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawReason = resolvedSearchParams.reason;
  const reason = Array.isArray(rawReason) ? rawReason[0] ?? '' : rawReason ?? '';
  const copy = reasonCopy[reason] ?? {
    title: 'A valid access link is required',
    description:
      'ZenDocx is not meant to be entered through a generic public link. Use the exact tenant portal URL or the platform admin link that was shared with you.',
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#eef3fb_0%,#f7f9fd_45%,#ffffff_100%)] px-4 py-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center justify-center">
        <section className="w-full rounded-[2.25rem] border border-white/70 bg-white/95 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur xl:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-[#0D1B3E] text-amber-400 shadow-lg shadow-[#0D1B3E]/20">
              <ShieldAlert size={28} />
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Access Required
            </p>
            <h1 className="mt-3 text-[2.2rem] font-black leading-[1.02] tracking-[-0.04em] text-slate-950 md:text-[2.6rem]">
              {copy.title}
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-500">
              {copy.description}
            </p>

            <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-slate-50 px-5 py-5 text-left">
              <p className="text-sm font-semibold text-slate-900">Use one of these approved entry points</p>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                <li>
                  Your business or tenant portal URL, shared directly by the organization you belong to
                </li>
                <li>
                  The dedicated platform admin link, shared internally with ZenDocx platform owners
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
