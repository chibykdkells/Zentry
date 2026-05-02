'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

// ── Phone mockup components ──────────────────────────────────────────────────

function PhoneFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative flex flex-col overflow-hidden bg-[#060e1c] ${className}`}
      style={{
        width: 192,
        height: 412,
        borderRadius: 36,
        border: '2px solid rgba(255,255,255,0.10)',
        boxShadow: '0 28px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset',
      }}
    >
      {/* Status bar */}
      <div className="relative flex items-center justify-between shrink-0 px-5 pt-3 pb-1">
        <span className="text-white/50 font-medium tabular-nums" style={{ fontSize: 8 }}>9:41</span>
        {/* Dynamic island */}
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 bg-black"
          style={{ width: 52, height: 14, borderRadius: 10 }}
        />
        {/* Signal + battery */}
        <div className="flex items-center gap-1">
          <div className="flex items-end gap-[1.5px]" style={{ height: 9 }}>
            {[3, 5, 7, 9].map((h, i) => (
              <div key={i} className="w-[2px] bg-white/50 rounded-[1px]" style={{ height: h }} />
            ))}
          </div>
          <div
            className="relative border border-white/40"
            style={{ width: 14, height: 7, borderRadius: 2 }}
          >
            <div
              className="absolute bg-white/50"
              style={{ inset: 1, right: 2, borderRadius: 1 }}
            />
            <div
              className="absolute -right-[2px] bg-white/30"
              style={{ top: 2, width: 1.5, height: 3, borderRadius: '0 1px 1px 0' }}
            />
          </div>
        </div>
      </div>

      {/* Screen content */}
      <div className="flex-1 overflow-hidden">{children}</div>

      {/* Home indicator */}
      <div className="flex justify-center shrink-0 py-2">
        <div className="bg-white/20 rounded-full" style={{ width: 64, height: 3 }} />
      </div>
    </div>
  );
}

function PortalScreen() {
  return (
    <div className="h-full bg-white flex flex-col">
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-100 shrink-0">
        <div
          className="bg-[#0D1B3E] flex items-center justify-center shrink-0"
          style={{ width: 20, height: 20, borderRadius: 5 }}
        >
          <span className="text-[#F5A623] font-bold" style={{ fontSize: 7 }}>Y</span>
        </div>
        <span className="font-bold text-[#0D1B3E]" style={{ fontSize: 9 }}>yourbiz.com</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
        <div
          className="bg-[#0D1B3E] flex items-center justify-center mb-3"
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(13,27,62,0.35)',
          }}
        >
          <span className="text-[#F5A623] font-bold" style={{ fontSize: 22 }}>Y</span>
        </div>

        <p className="font-bold text-[#0D1B3E] leading-tight" style={{ fontSize: 10 }}>Welcome to</p>
        <p className="font-extrabold text-[#0D1B3E]" style={{ fontSize: 15 }}>yourbiz.com</p>
        <p className="text-gray-400 mt-1 mb-5" style={{ fontSize: 8 }}>
          Government services, made easy
        </p>

        <div className="w-full flex flex-col gap-2">
          <button
            className="w-full bg-[#F5A623] font-bold text-[#0D1B3E]"
            style={{ padding: '7px 0', borderRadius: 12, fontSize: 9 }}
          >
            Login to your account
          </button>
          <button
            className="w-full border border-gray-200 font-semibold text-[#0D1B3E]"
            style={{ padding: '7px 0', borderRadius: 12, fontSize: 9 }}
          >
            Create account
          </button>
        </div>
      </div>

      <div className="py-2.5 text-center border-t border-gray-100 shrink-0">
        <span className="text-gray-400" style={{ fontSize: 7 }}>Powered by ZenDocx</span>
      </div>
    </div>
  );
}

function DashboardScreen() {
  return (
    <div className="h-full bg-[#f4f5f9] flex flex-col">
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 shrink-0">
        <div>
          <p className="text-gray-400" style={{ fontSize: 7 }}>Good morning</p>
          <p className="font-bold text-[#0D1B3E]" style={{ fontSize: 10 }}>Kelvin 👋</p>
        </div>
        <div className="relative bg-gray-100 rounded-full flex items-center justify-center" style={{ width: 24, height: 24 }}>
          <span style={{ fontSize: 11 }}>🔔</span>
          <div
            className="absolute bg-[#F5A623] border-white border"
            style={{ width: 7, height: 7, borderRadius: 999, top: -1, right: -1 }}
          />
        </div>
      </div>

      {/* Wallet card */}
      <div className="mx-3 mt-2.5 bg-[#0D1B3E] rounded-2xl p-3">
        <p className="text-gray-400" style={{ fontSize: 7 }}>Available Balance</p>
        <p className="font-extrabold text-white mt-0.5" style={{ fontSize: 17 }}>
          ₦45,200<span style={{ fontSize: 10 }}>.00</span>
        </p>
        <div className="flex gap-1.5 mt-2">
          <button
            className="flex-1 bg-[#F5A623] font-bold text-[#0D1B3E]"
            style={{ padding: '5px 0', borderRadius: 8, fontSize: 7 }}
          >
            Fund Account
          </button>
          <button
            className="flex-1 bg-white/10 font-semibold text-white/80"
            style={{ padding: '5px 0', borderRadius: 8, fontSize: 7 }}
          >
            History
          </button>
        </div>
      </div>

      {/* Services */}
      <div className="px-3 mt-2.5">
        <p className="font-bold text-gray-600 mb-1.5" style={{ fontSize: 8 }}>Services</p>
        <div className="grid grid-cols-4 gap-1">
          {([
            ['🎓', 'JAMB', '#eff6ff'],
            ['🪪', 'NIMC', '#f0fdf4'],
            ['📝', 'NECO', '#fffbeb'],
            ['⚡', 'VTU', '#faf5ff'],
          ] as const).map(([emoji, label, bg]) => (
            <div
              key={label}
              className="flex flex-col items-center gap-0.5 py-2"
              style={{ background: bg, borderRadius: 12 }}
            >
              <span style={{ fontSize: 14 }}>{emoji}</span>
              <span className="font-bold text-gray-600" style={{ fontSize: 6.5 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent order */}
      <div className="px-3 mt-2">
        <p className="font-bold text-gray-600 mb-1.5" style={{ fontSize: 8 }}>Recent Orders</p>
        <div className="bg-white rounded-xl px-2.5 py-2 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800" style={{ fontSize: 8 }}>JAMB Registration</p>
            <p className="text-gray-400 mt-0.5" style={{ fontSize: 7 }}>₦5,000 · Today</p>
          </div>
          <span
            className="bg-amber-100 text-amber-700 font-bold"
            style={{ fontSize: 6, padding: '2px 6px', borderRadius: 999 }}
          >
            Pending
          </span>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="mt-auto flex border-t border-gray-200 bg-white shrink-0">
        {([
          ['🏠', 'Home', true],
          ['📋', 'Orders', false],
          ['💰', 'Wallet', false],
          ['⋯', 'More', false],
        ] as const).map(([icon, label, active]) => (
          <div
            key={label}
            className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 ${active ? 'text-[#F5A623]' : 'text-gray-400'}`}
          >
            <span style={{ fontSize: 11 }}>{icon}</span>
            <span className="font-medium" style={{ fontSize: 6.5 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function JobPoolScreen() {
  return (
    <div className="h-full bg-[#f4f5f9] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 shrink-0">
        <p className="font-bold text-[#0D1B3E]" style={{ fontSize: 10 }}>Job Pool</p>
        <span
          className="bg-[#F5A623]/20 text-[#8a5a00] font-semibold"
          style={{ fontSize: 7, padding: '2px 8px', borderRadius: 999 }}
        >
          12 open
        </span>
      </div>

      {/* Jobs */}
      <div className="flex-1 px-3 py-2.5 flex flex-col gap-2 overflow-hidden">
        {([
          ['JAMB Registration', '₦2,500', 'JAMB', '#dbeafe', '#1d4ed8'],
          ['NIMC Enrollment', '₦1,800', 'NIMC', '#dcfce7', '#15803d'],
          ['NECO Checker', '₦1,200', 'NECO', '#fef9c3', '#a16207'],
        ] as const).map(([title, commission, tag, tagBg, tagColor]) => (
          <div key={title} className="bg-white rounded-xl p-2.5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="flex items-start justify-between mb-1.5">
              <div>
                <p className="font-bold text-[#0D1B3E] leading-tight" style={{ fontSize: 8 }}>{title}</p>
                <span
                  className="inline-block font-semibold mt-0.5"
                  style={{ fontSize: 6, padding: '1px 5px', borderRadius: 999, background: tagBg, color: tagColor }}
                >
                  {tag}
                </span>
              </div>
              <div className="text-right">
                <p className="text-gray-400" style={{ fontSize: 6 }}>commission</p>
                <p className="font-extrabold text-[#F5A623]" style={{ fontSize: 10 }}>{commission}</p>
              </div>
            </div>
            <button
              className="w-full bg-[#0D1B3E] font-bold text-white"
              style={{ padding: '4px 0', borderRadius: 8, fontSize: 7 }}
            >
              Claim Job
            </button>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div className="flex border-t border-gray-200 bg-white shrink-0">
        {([
          ['🏠', 'Home', false],
          ['📋', 'Jobs', true],
          ['💼', 'My Jobs', false],
          ['💰', 'Earn', false],
        ] as const).map(([icon, label, active]) => (
          <div
            key={label}
            className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 ${active ? 'text-[#F5A623]' : 'text-gray-400'}`}
          >
            <span style={{ fontSize: 11 }}>{icon}</span>
            <span className="font-medium" style={{ fontSize: 6.5 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Landing page ─────────────────────────────────────────────────────────────

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0D1B3E] flex items-center justify-center">
              <span className="text-[#F5A623] font-bold text-sm">Z</span>
            </div>
            <span className="font-bold text-[#0D1B3E] text-lg tracking-tight">ZenDocx</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-600 hover:text-[#0D1B3E] transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-gray-600 hover:text-[#0D1B3E] transition-colors">How it works</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-[#0D1B3E] transition-colors">Pricing</a>
            <a href="/platform/login" className="text-sm text-gray-600 hover:text-[#0D1B3E] transition-colors">Platform Login</a>
            <a
              href="mailto:hello@zendocx.net?subject=Demo Request"
              className="px-4 py-2 bg-[#F5A623] text-[#0D1B3E] text-sm font-semibold rounded-lg hover:bg-[#e8961a] transition-colors"
            >
              Request a Demo
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-gray-600"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <div className="w-5 h-0.5 bg-current mb-1" />
            <div className="w-5 h-0.5 bg-current mb-1" />
            <div className="w-5 h-0.5 bg-current" />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 flex flex-col gap-4">
            <a href="#features" className="text-sm text-gray-600" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="text-sm text-gray-600" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#pricing" className="text-sm text-gray-600" onClick={() => setMenuOpen(false)}>Pricing</a>
            <a href="/platform/login" className="text-sm text-gray-600">Platform Login</a>
            <a
              href="mailto:hello@zendocx.net?subject=Demo Request"
              className="px-4 py-2 bg-[#F5A623] text-[#0D1B3E] text-sm font-semibold rounded-lg text-center"
            >
              Request a Demo
            </a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-16 px-4 sm:px-6 bg-[#0D1B3E] overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center gap-10 lg:gap-0">

            {/* Left: text */}
            <div className="lg:w-[54%] lg:pr-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F5A623]/20 rounded-full mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F5A623]" />
                <span className="text-[#F5A623] text-xs font-semibold uppercase tracking-wide">White-label SaaS Platform</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                Launch Your Government Services Business in Days
              </h1>
              <p className="text-lg text-gray-300 mb-10 leading-relaxed">
                ZenDocx gives your business a complete, ready-to-use escrow marketplace for JAMB, NIMC, NECO, and VTU services — with wallet management, CBT job fulfilment, disputes, and admin analytics all built in.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="mailto:hello@zendocx.net?subject=Demo Request"
                  className="px-8 py-4 bg-[#F5A623] text-[#0D1B3E] font-bold rounded-xl text-center hover:bg-[#e8961a] transition-colors"
                >
                  Request a Demo
                </a>
                <a
                  href="#how-it-works"
                  className="px-8 py-4 border border-white/20 text-white font-semibold rounded-xl text-center hover:bg-white/10 transition-colors"
                >
                  See How It Works
                </a>
              </div>
            </div>

            {/* Right: phone cluster */}
            <div className="lg:w-[46%]">

              {/* Mobile: single phone, centered */}
              <div className="flex justify-center lg:hidden">
                <div style={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                  <PhoneFrame><DashboardScreen /></PhoneFrame>
                </div>
              </div>

              {/* Desktop: three phones stacked with fade */}
              <div className="hidden lg:block relative" style={{ height: 460 }}>
                {/* Phone 3 — back / rightmost */}
                <div className="absolute z-10" style={{ left: 300, top: 46, opacity: 0.42 }}>
                  <PhoneFrame><JobPoolScreen /></PhoneFrame>
                </div>
                {/* Phone 2 — middle */}
                <div className="absolute z-20" style={{ left: 162, top: 23, opacity: 0.72 }}>
                  <PhoneFrame><DashboardScreen /></PhoneFrame>
                </div>
                {/* Phone 1 — front / leftmost */}
                <div className="absolute z-30" style={{ left: 24, top: 0 }}>
                  <PhoneFrame><PortalScreen /></PhoneFrame>
                </div>
                {/* Fade to right */}
                <div
                  className="absolute inset-y-0 right-0 pointer-events-none z-40"
                  style={{
                    width: 160,
                    background: 'linear-gradient(to left, #0D1B3E 0%, rgba(13,27,62,0.7) 45%, transparent 100%)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { value: '< 48hrs', label: 'Time to go live' },
              { value: '4 services', label: 'Government service types' },
              { value: '100%', label: 'Escrow protected' },
              { value: '0 code', label: 'Required from you' },
            ].map((stat) => (
              <div key={stat.label} className="border border-white/10 rounded-xl p-4">
                <div className="text-2xl font-bold text-[#F5A623]">{stat.value}</div>
                <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0D1B3E] mb-4">How it works</h2>
            <p className="text-gray-500 max-w-xl mx-auto">You focus on growing your business. ZenDocx handles the technology.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Sign up & configure',
                desc: 'We set up your branded portal with your logo, domain, and service pricing. Your portal is live in under 48 hours.',
              },
              {
                step: '02',
                title: 'Onboard your network',
                desc: 'Invite your CBT centers to your platform. They pick jobs from the pool, fulfil them, and get paid automatically.',
              },
              {
                step: '03',
                title: 'Grow & earn',
                desc: 'Every transaction runs through escrow. You collect your commission automatically. Full admin analytics show you everything.',
              },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-2xl p-8 border border-gray-100">
                <div className="text-4xl font-bold text-[#F5A623]/30 mb-4">{item.step}</div>
                <h3 className="text-lg font-bold text-[#0D1B3E] mb-3">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0D1B3E] mb-4">Everything you need, built in</h2>
            <p className="text-gray-500 max-w-xl mx-auto">No third-party integrations to stitch together. Every feature ships as part of your platform.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: '🏦',
                title: 'Wallet & Escrow',
                desc: 'Every order locks funds in escrow. CBT centers get paid only after a 2-hour dispute window closes. Zero financial risk.',
              },
              {
                icon: '📋',
                title: 'CBT Job Pool',
                desc: 'Licensed CBT centers see available jobs in real-time, claim them atomically, upload results, and get commission instantly.',
              },
              {
                icon: '⚡',
                title: 'VTU Automation',
                desc: 'Airtime, data, cable TV, and electricity top-ups are processed instantly via provider APIs. No manual handling.',
              },
              {
                icon: '⚖️',
                title: 'Dispute Resolution',
                desc: 'Built-in dispute flow with redo requests, refunds, and CBT penalties. Every case is admin-reviewed with a full audit trail.',
              },
              {
                icon: '📊',
                title: 'Admin Analytics',
                desc: 'Revenue charts, CBT performance metrics, wallet float overview, and CSV exports. Run your business from a single dashboard.',
              },
              {
                icon: '🔔',
                title: 'Real-time Notifications',
                desc: 'WebSocket live updates and browser push notifications keep requesters, CBT centers, and admins in sync instantly.',
              },
              {
                icon: '📲',
                title: 'Installable PWA App',
                desc: "Your platform ships as a Progressive Web App — your customers install it to their home screen from any browser, no app store needed. Works offline, feels native.",
              },
            ].map((feature) => (
              <div key={feature.title} className="p-6 rounded-2xl border border-gray-100 hover:border-[#F5A623]/40 hover:shadow-sm transition-all">
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="font-bold text-[#0D1B3E] mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0D1B3E] mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Pay a flat monthly licence fee. Keep all the commission your platform earns. No per-transaction cuts from us.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Starter</div>
              <div className="text-4xl font-bold text-[#0D1B3E] mb-1">Custom</div>
              <div className="text-sm text-gray-400 mb-6">Contact us for pricing</div>
              <ul className="space-y-3 text-sm text-gray-600 mb-8">
                {['Your own branded portal', 'Up to 20 CBT centers', 'All service types', 'Admin dashboard', 'Installable PWA for your users', 'Email & SMS notifications', 'Standard support'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="text-[#F5A623]">✓</span> {item}
                  </li>
                ))}
              </ul>
              <a
                href="mailto:hello@zendocx.net?subject=Starter Plan Enquiry"
                className="block w-full py-3 border-2 border-[#0D1B3E] text-[#0D1B3E] font-semibold rounded-xl text-center hover:bg-[#0D1B3E] hover:text-white transition-colors"
              >
                Get in touch
              </a>
            </div>

            <div className="bg-[#0D1B3E] rounded-2xl p-8 border border-[#0D1B3E] relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#F5A623] rounded-full text-xs font-bold text-[#0D1B3E]">Most Popular</div>
              <div className="text-sm font-semibold text-[#F5A623] uppercase tracking-wide mb-2">Growth</div>
              <div className="text-4xl font-bold text-white mb-1">Custom</div>
              <div className="text-sm text-gray-400 mb-6">Contact us for pricing</div>
              <ul className="space-y-3 text-sm text-gray-300 mb-8">
                {['Everything in Starter', 'Unlimited CBT centers', 'VTU automated services', 'Advanced analytics & exports', 'Custom domain support', 'Priority support'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="text-[#F5A623]">✓</span> {item}
                  </li>
                ))}
              </ul>
              <a
                href="mailto:hello@zendocx.net?subject=Growth Plan Enquiry"
                className="block w-full py-3 bg-[#F5A623] text-[#0D1B3E] font-bold rounded-xl text-center hover:bg-[#e8961a] transition-colors"
              >
                Get in touch
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 bg-[#0D1B3E]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to launch your platform?</h2>
          <p className="text-gray-300 mb-10">Join businesses already using ZenDocx to power their government services operations.</p>
          <a
            href="mailto:hello@zendocx.net?subject=Demo Request"
            className="inline-block px-10 py-4 bg-[#F5A623] text-[#0D1B3E] font-bold rounded-xl hover:bg-[#e8961a] transition-colors"
          >
            Request a Demo Today
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 sm:px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#0D1B3E] flex items-center justify-center">
              <span className="text-[#F5A623] font-bold text-xs">Z</span>
            </div>
            <span className="font-bold text-[#0D1B3E] text-sm">ZenDocx</span>
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} ZenDocx. Fast. Trusted. Government Services, Simplified.</p>
          <div className="flex items-center gap-6">
            <a href="mailto:hello@zendocx.net" className="text-xs text-gray-400 hover:text-[#0D1B3E]">hello@zendocx.net</a>
            <a href="/platform/login" className="text-xs text-gray-400 hover:text-[#0D1B3E]">Platform Login</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
