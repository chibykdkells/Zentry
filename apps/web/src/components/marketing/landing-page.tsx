'use client';

import { useState } from 'react';

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
      <section className="pt-24 pb-20 px-4 sm:px-6 bg-[#0D1B3E]">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F5A623]/20 rounded-full mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F5A623]" />
              <span className="text-[#F5A623] text-xs font-semibold uppercase tracking-wide">White-label SaaS Platform</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Launch Your Government Services Business in Days
            </h1>
            <p className="text-lg text-gray-300 mb-10 max-w-2xl leading-relaxed">
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

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6">
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
                {['Your own branded portal', 'Up to 20 CBT centers', 'All service types', 'Admin dashboard', 'Email & SMS notifications', 'Standard support'].map((item) => (
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
