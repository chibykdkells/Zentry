'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { useAuthProfile } from '@/hooks/use-auth-profile';
import { useOrders } from '@/hooks/use-orders';
import { useServiceCatalog } from '@/hooks/use-service-catalog';
import { WalletCard } from '@/components/wallet/wallet-card';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import { appendTenantContextToPath, resolveTenantSlugForRequest } from '@/lib/tenant-runtime';
import { formatDate } from '@/lib/format';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Slug-based emoji + background lookup. Matches on substring so
// "jamb-registration" and "jamb" both resolve to the same entry.
const CATEGORY_ICON_MAP: Array<{ match: string; emoji: string; bg: string }> = [
  { match: 'jamb',       emoji: '🎓', bg: 'bg-[#F6F1E7]' },
  { match: 'nimc',       emoji: '🪪', bg: 'bg-slate-100'  },
  { match: 'neco',       emoji: '📝', bg: 'bg-amber-50'   },
  { match: 'waec',       emoji: '📋', bg: 'bg-yellow-50'  },
  { match: 'nabteb',     emoji: '🏫', bg: 'bg-blue-50'    },
  { match: 'vtu',        emoji: '⚡', bg: 'bg-sky-50'     },
  { match: 'airtime',    emoji: '📱', bg: 'bg-sky-50'     },
  { match: 'data',       emoji: '📶', bg: 'bg-indigo-50'  },
  { match: 'cable',      emoji: '📺', bg: 'bg-purple-50'  },
  { match: 'electric',   emoji: '💡', bg: 'bg-yellow-50'  },
  { match: 'identity',   emoji: '🪪', bg: 'bg-slate-100'  },
  { match: 'passport',   emoji: '📘', bg: 'bg-blue-50'    },
  { match: 'driving',    emoji: '🚗', bg: 'bg-green-50'   },
  { match: 'birth',      emoji: '📜', bg: 'bg-rose-50'    },
  { match: 'marriage',   emoji: '💍', bg: 'bg-pink-50'    },
  { match: 'tax',        emoji: '🏛️', bg: 'bg-orange-50'  },
  { match: 'cac',        emoji: '🏢', bg: 'bg-teal-50'    },
];

const FALLBACK_ICONS = ['📂', '📌', '🗂️', '🔖', '📎', '🗃️'];

function getCategoryIcon(slug: string, index: number): { emoji: string; bg: string } {
  const lower = slug.toLowerCase();
  const found = CATEGORY_ICON_MAP.find((entry) => lower.includes(entry.match));
  if (found) return found;
  const emoji = FALLBACK_ICONS[index % FALLBACK_ICONS.length] ?? '📂';
  const fallbackBgs = ['bg-slate-100', 'bg-amber-50', 'bg-sky-50', 'bg-green-50', 'bg-purple-50', 'bg-rose-50'];
  return { emoji, bg: fallbackBgs[index % fallbackBgs.length] ?? 'bg-slate-100' };
}

const statusStyles: Record<string, { cls: string; label: string }> = {
  PENDING:     { cls: 'bg-amber-100 text-amber-700',     label: 'Pending' },
  ASSIGNED:    { cls: 'bg-blue-100 text-blue-700',       label: 'Assigned' },
  IN_PROGRESS: { cls: 'bg-cyan-100 text-cyan-700',       label: 'In Progress' },
  COMPLETED:   { cls: 'bg-emerald-100 text-emerald-700', label: 'Completed' },
  DISPUTED:    { cls: 'bg-rose-100 text-rose-700',       label: 'Disputed' },
  CANCELLED:   { cls: 'bg-slate-100 text-slate-500',     label: 'Cancelled' },
};

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const { profile, loading } = useAuthProfile();
  const { orders, loading: ordersLoading } = useOrders();
  const tenantSlug =
    typeof window !== 'undefined' ? resolveTenantSlugForRequest() : null;

  const { categories, loading: categoriesLoading } = useServiceCatalog({
    tenantSlug: tenantSlug ?? undefined,
  });

  // Only show categories that have at least one service
  const activeCategories = categories.filter((c) => c.serviceCount > 0);

  const wallet = profile?.wallet ?? { availableBalance: '0', escrowBalance: '0' };
  const firstName = profile?.firstName ?? user?.firstName ?? 'Welcome';
  const recentOrders = orders.slice(0, 3);

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-5 pb-28 md:max-w-2xl md:px-6 md:py-8">

      {/* Greeting */}
      <div className="pt-1">
        <p className="text-sm text-brand-muted">{getGreeting()}</p>
        <h1 className="mt-0.5 text-[1.65rem] font-bold leading-tight text-brand-ink">
          {loading
            ? <span className="inline-block h-8 w-36 animate-pulse rounded-lg bg-slate-200" />
            : `${firstName} 👋`}
        </h1>
      </div>

      {/* Balance card */}
      {loading ? (
        <SkeletonBlock className="h-44 rounded-3xl" />
      ) : (
        <WalletCard
          availableBalance={wallet.availableBalance}
          escrowBalance={wallet.escrowBalance}
          onFundClick={() =>
            window.location.assign(appendTenantContextToPath('/wallet', tenantSlug))
          }
          actionLabel="Fund Account"
          secondaryAction={{
            label: 'History',
            onClick: () =>
              window.location.assign(appendTenantContextToPath('/wallet', tenantSlug)),
          }}
        />
      )}

      {/* Services */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-brand-ink">Services</h2>
          <Link
            href={appendTenantContextToPath('/services', tenantSlug)}
            className="text-xs font-semibold text-brand-accent hover:underline"
          >
            See all
          </Link>
        </div>

        {categoriesLoading ? (
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-24 w-20 shrink-0 rounded-2xl" />
            ))}
          </div>
        ) : activeCategories.length > 0 ? (
          <div className="flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {activeCategories.map((category, index) => {
              const { emoji, bg } = getCategoryIcon(category.slug, index);
              return (
                <Link
                  key={category.id}
                  href={appendTenantContextToPath(
                    `/services?categorySlug=${category.slug}`,
                    tenantSlug,
                  )}
                  className="flex w-20 shrink-0 flex-col items-center gap-2.5 rounded-2xl border border-brand-line bg-brand-surface py-4 transition hover:shadow-sm active:scale-95"
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl ${bg}`}>
                    {emoji}
                  </span>
                  <span className="w-full truncate px-1 text-center text-xs font-semibold text-brand-ink">
                    {category.name}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 text-center">
            <p className="text-sm text-brand-muted">No services available yet.</p>
          </div>
        )}
      </section>

      {/* Recent Orders */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-brand-ink">Recent Orders</h2>
          <Link
            href={appendTenantContextToPath('/orders', tenantSlug)}
            className="text-xs font-semibold text-brand-accent hover:underline"
          >
            See all
          </Link>
        </div>

        {ordersLoading ? (
          <div className="space-y-2.5">
            <SkeletonBlock className="h-[4.5rem] rounded-2xl" />
            <SkeletonBlock className="h-[4.5rem] rounded-2xl" />
            <SkeletonBlock className="h-[4.5rem] rounded-2xl" />
          </div>
        ) : recentOrders.length > 0 ? (
          <div className="space-y-2.5">
            {recentOrders.map((order) => {
              const s = statusStyles[order.status] ?? { cls: 'bg-slate-100 text-slate-500', label: order.status };
              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-2xl border border-brand-line bg-brand-surface px-4 py-3.5 shadow-sm"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-semibold text-brand-ink">
                      {order.service.name}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-muted">
                      {order.orderNumber} · {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${s.cls}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-center">
            <p className="text-sm text-brand-muted">
              No orders yet — start by browsing available services.
            </p>
            <Link
              href={appendTenantContextToPath('/services', tenantSlug)}
              className="mt-3 inline-flex rounded-xl bg-brand-navy px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-navy-strong"
            >
              Browse services
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
