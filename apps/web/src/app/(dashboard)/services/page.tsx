'use client';

import { useMemo, useState, type ElementType } from 'react';
import { ArrowRight, ChevronDown, Search, Zap, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { CreateOrderModal } from '@/components/orders/create-order-modal';
import { MobileSheet } from '@/components/shared/mobile-sheet';
import { EmptyState } from '@/components/shared/empty-state';
import { SkeletonBlock } from '@/components/shared/skeleton-loader';
import { useOrders } from '@/hooks/use-orders';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useServiceCatalog } from '@/hooks/use-service-catalog';
import { formatNaira } from '@/lib/format';
import { catalogCategoriesMeta } from '@/lib/service-catalog';
import { cn } from '@/lib/utils';
import { ServiceDeliveryMode } from '@zentry/types';

export default function ServicesPage() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | 'ALL'>('ALL');
  const [expandedSlugs, setExpandedSlugs] = useState<string[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const { categories, services, loading, error, reload } = useServiceCatalog({
    search: query,
    categorySlug: activeCategory === 'ALL' ? undefined : activeCategory,
  });
  const { reload: reloadOrders } = useOrders();

  const categoriesWithMeta = useMemo(() => {
    const map = new Map<string, { id: string; name: string; slug: string; description: string | null }>();
    categories.forEach((c) => map.set(c.slug, c));
    services.forEach((s) => {
      if (!map.has(s.category.slug)) {
        map.set(s.category.slug, { id: s.category.id, name: s.category.name, slug: s.category.slug, description: s.category.description });
      }
    });
    return Array.from(map.values()).map((c) => {
      const meta = catalogCategoriesMeta.find((m) => m.slug === c.slug);
      return { ...c, title: meta?.title ?? c.name, icon: meta?.icon ?? catalogCategoriesMeta[0].icon };
    });
  }, [categories, services]);

  const groupedServices = useMemo(
    () =>
      categoriesWithMeta
        .map((c) => ({ ...c, services: services.filter((s) => s.category.slug === c.slug) }))
        .filter((c) => c.services.length > 0),
    [categoriesWithMeta, services],
  );

  const effectiveExpanded = useMemo(() => {
    if (activeCategory !== 'ALL') return groupedServices.map((c) => c.slug);
    if (!groupedServices.length) return [];
    const valid = expandedSlugs.filter((slug) => groupedServices.some((c) => c.slug === slug));
    return valid.length ? valid : [groupedServices[0].slug];
  }, [activeCategory, expandedSlugs, groupedServices]);

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;

  const openPreview = (id: string) => { setSelectedServiceId(id); setIsPreviewOpen(true); };
  const openOrder = (id: string) => { setSelectedServiceId(id); setIsPreviewOpen(false); setIsOrderModalOpen(true); };
  const closeOrder = () => { setIsOrderModalOpen(false); setSelectedServiceId(null); };
  const toggleCategory = (slug: string) =>
    setExpandedSlugs((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <CreateOrderModal
        open={Boolean(selectedService) && isOrderModalOpen}
        service={selectedService}
        onClose={closeOrder}
        onSuccess={() => {
          reloadOrders();
          closeOrder();
          toast.success('Order placed. Track it in My Orders.');
        }}
      />

      <MobileSheet
        open={Boolean(selectedService) && isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={selectedService?.name ?? 'Service details'}
        description={selectedService?.category.name ?? ''}
        footer={
          selectedService ? (
            <button
              onClick={() => openOrder(selectedService.id)}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-button px-4 py-3 text-sm font-semibold text-white hover:bg-brand-button-strong"
            >
              Request this service
              <ArrowRight size={16} />
            </button>
          ) : null
        }
      >
        {selectedService ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-brand-line bg-brand-surface-soft px-4 py-3">
              <span className="text-lg font-bold text-brand-ink">
                {formatNaira(selectedService.totalPrice)}
              </span>
              <DeliveryBadge mode={selectedService.deliveryMode} />
            </div>
            {selectedService.description ? (
              <p className="text-sm leading-6 text-brand-muted">
                {selectedService.description}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <InfoTile label="Delivery" value={selectedService.eta} />
              <InfoTile label="Fields required" value={`${selectedService.requiredFieldsCount}`} />
              {selectedService.requiredDocumentsCount > 0 && (
                <InfoTile label="Documents" value={`${selectedService.requiredDocumentsCount} upload(s)`} />
              )}
            </div>
          </div>
        ) : null}
      </MobileSheet>

      {/* Page header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">Services</h1>
          <p className="mt-0.5 text-sm text-brand-muted">Browse and request government and VTU services</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search JAMB, NIN, airtime, data…"
          className="w-full rounded-xl border border-brand-line bg-white py-2.5 pl-10 pr-4 text-sm text-brand-ink placeholder:text-brand-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/10"
        />
      </div>

      {/* Category chips */}
      {!loading && !error && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory('ALL')}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
              activeCategory === 'ALL'
                ? 'bg-brand-navy text-white'
                : 'bg-white border border-brand-line text-brand-muted hover:border-brand-navy/30',
            )}
          >
            All
            <span className={cn('ml-1.5 text-xs', activeCategory === 'ALL' ? 'opacity-70' : 'text-brand-muted')}>
              {services.length}
            </span>
          </button>
          {categoriesWithMeta.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.slug)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                activeCategory === c.slug
                  ? 'bg-brand-navy text-white'
                  : 'bg-white border border-brand-line text-brand-muted hover:border-brand-navy/30',
              )}
            >
              <c.icon size={13} />
              {c.title}
            </button>
          ))}
        </div>
      )}

      {/* Service list */}
      {error ? (
        <EmptyState
          title="Services unavailable"
          message={error}
          action={
            <button onClick={reload} className="rounded-xl border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-surface-soft">
              Try again
            </button>
          }
        />
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : groupedServices.length ? (
        <div className="space-y-3">
          {groupedServices.map((category) => {
            const isOpen = effectiveExpanded.includes(category.slug);
            return (
              <div key={category.id} className="overflow-hidden rounded-2xl border border-brand-line bg-white">
                <button
                  onClick={() => toggleCategory(category.slug)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-brand-surface-soft/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-navy/[0.07] text-brand-navy">
                      <category.icon size={17} />
                    </div>
                    <span className="text-sm font-semibold text-brand-ink">{category.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-full bg-brand-surface-soft px-2 py-0.5 text-xs font-semibold text-brand-muted">
                      {category.services.length}
                    </span>
                    <ChevronDown
                      size={15}
                      className={cn('text-brand-muted transition-transform', isOpen && 'rotate-180')}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-brand-line divide-y divide-brand-line/60">
                    {category.services.map((service) => (
                      <ServiceRow
                        key={service.id}
                        service={service}
                        isMobile={isMobile}
                        onOrder={() => openOrder(service.id)}
                        onPreview={() => openPreview(service.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No services found"
          message={query ? 'Try a different search term.' : 'No services are available right now.'}
        />
      )}
    </div>
  );
}

function ServiceRow({
  service,
  isMobile,
  onOrder,
  onPreview,
}: {
  service: {
    id: string;
    name: string;
    description: string | null;
    totalPrice: string;
    eta: string;
    requiredFieldsCount: number;
    requiredDocumentsCount: number;
    deliveryMode: ServiceDeliveryMode;
    category: { name: string; description: string | null; slug: string };
  };
  isMobile: boolean;
  onOrder: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-brand-surface-soft/40 cursor-pointer"
      onClick={isMobile ? onPreview : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-brand-ink truncate">{service.name}</span>
          <DeliveryBadge mode={service.deliveryMode} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-brand-muted">
          <span className="flex items-center gap-1">
            <Zap size={11} />
            {formatNaira(service.totalPrice)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {service.eta}
          </span>
          {service.requiredDocumentsCount > 0 && (
            <span>{service.requiredDocumentsCount} doc(s)</span>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {isMobile ? (
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(); }}
            className="rounded-xl border border-brand-line bg-white px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-surface-soft"
          >
            Details
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onOrder(); }}
            className="flex items-center gap-1.5 rounded-xl bg-brand-button px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-button-strong"
          >
            Request
            <ArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function DeliveryBadge({ mode }: { mode: ServiceDeliveryMode }) {
  if (mode === ServiceDeliveryMode.API_AUTOMATED) {
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Instant</span>;
  }
  if (mode === ServiceDeliveryMode.PIN_STOCK) {
    return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">PIN stock</span>;
  }
  return <span className="rounded-full bg-brand-surface-soft px-2 py-0.5 text-[10px] font-semibold text-brand-muted">Manual</span>;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-line bg-white px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-brand-ink">{value}</p>
    </div>
  );
}
