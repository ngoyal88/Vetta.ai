import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { WebsiteLayout } from '../components/WebsiteLayout';

type BillingCycle = 'monthly' | 'annual';

type PricingPlan = {
  id: string;
  name: string;
  description: string;
  highlight?: boolean;
  priceMonthly?: number;
  priceAnnual?: number;
  priceLabel?: string;
  ctaLabel: string;
  ctaHref: string;
  ctaVariant?: 'primary' | 'ghost';
  features: string[];
};

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Essential tools for individual candidates.',
    priceLabel: 'Free',
    ctaLabel: 'Get Started',
    ctaHref: '/signup',
    ctaVariant: 'ghost',
    features: ['Basic resume parsing', '5 job matches per month', 'Standard support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Advanced AI agents for aggressive scaling.',
    highlight: true,
    priceMonthly: 799,
    priceAnnual: 639,
    ctaLabel: 'Upgrade to Pro',
    ctaHref: '/signup',
    ctaVariant: 'primary',
    features: [
      'Unlimited resume parsing',
      'Unlimited job matches',
      'Active apply agent status',
      'Priority AI pipeline',
    ],
  },
  {
    id: 'teams',
    name: 'Teams',
    description: 'For recruiting agencies and large orgs.',
    priceLabel: 'Custom',
    ctaLabel: 'Contact Sales',
    ctaHref: '/contact',
    ctaVariant: 'ghost',
    features: ['Custom AI models', 'API access', 'Dedicated success manager'],
  },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const reduceMotion = useReducedMotion();

  return (
    <WebsiteLayout showDecorations mainClassName="pt-28 pb-32">
      <section className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <div
          className="landing-hero-glow pointer-events-none absolute -top-24 h-[min(520px,70vw)] w-[min(520px,70vw)] rounded-full blur-[120px]"
          aria-hidden="true"
        />
        <motion.div
          className="relative z-10"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0, 0, 0.2, 1] }}
        >
          <p className="type-label-md uppercase tracking-widest text-[var(--color-secondary)]">
            Pricing
          </p>
          <h1 className="type-display-lg mt-3 text-[var(--color-on-surface)]">
            One plan. No tricks.
          </h1>
          <p className="type-body-lg mt-4 text-[var(--color-on-surface-variant)]">
            Transparent pricing engineered for professionals who demand clarity. Scale your
            intelligence without scaling your overhead.
          </p>

          <div className="mt-8 inline-flex flex-wrap items-center justify-center gap-3">
            <div className="pricing-toggle" role="tablist" aria-label="Billing cycle">
              <button
                type="button"
                className={[
                  'pricing-toggle__btn type-label-md',
                  billingCycle === 'monthly' ? 'pricing-toggle__btn--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={billingCycle === 'monthly'}
                onClick={() => setBillingCycle('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                className={[
                  'pricing-toggle__btn type-label-md',
                  billingCycle === 'annual' ? 'pricing-toggle__btn--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={billingCycle === 'annual'}
                onClick={() => setBillingCycle('annual')}
              >
                Annual <span className="ml-1 type-label-sm text-[var(--color-secondary)]">-20%</span>
              </button>
            </div>
            <span className="type-label-sm text-[var(--color-on-surface-variant)]">
              {billingCycle === 'annual' ? 'Billed annually, save 20%' : 'Billed monthly'}
            </span>
          </div>
        </motion.div>
      </section>

      <motion.section
        className="mt-16 grid grid-cols-1 gap-gutter md:grid-cols-3"
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0, 0, 0.2, 1], delay: reduceMotion ? 0 : 0.1 }}
      >
        {PRICING_PLANS.map((plan) => {
          const isCustom = Boolean(plan.priceLabel && !plan.priceMonthly);
          const priceValue = plan.priceLabel
            ? plan.priceLabel
            : billingCycle === 'annual'
              ? plan.priceAnnual
              : plan.priceMonthly;
          const priceSuffix = plan.priceLabel ? '' : '/mo';
          const iconClassName = plan.highlight
            ? 'text-[var(--color-secondary)]'
            : 'text-[var(--color-primary)]';
          const cardClassName = [
            'pricing-card',
            plan.highlight ? 'pricing-card--featured' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <article key={plan.id} className={cardClassName}>
              {plan.highlight ? (
                <span className="pricing-card__badge type-label-sm">Featured</span>
              ) : null}
              <div className="mb-6">
                <h3
                  className={[
                    'type-headline-md',
                    plan.highlight ? 'text-[var(--color-secondary)]' : 'text-[var(--color-on-surface)]',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {plan.name}
                </h3>
                <div className="pricing-price mt-4">
                  <span className="type-display-lg text-[var(--color-on-surface)]">
                    {typeof priceValue === 'number' ? `$${priceValue}` : priceValue}
                  </span>
                  {!isCustom && priceSuffix ? (
                    <span className="type-body-md mb-2 text-[var(--color-on-surface-variant)]">
                      {priceSuffix}
                    </span>
                  ) : null}
                </div>
                <p className="type-body-md mt-2 text-[var(--color-on-surface-variant)]">
                  {plan.description}
                </p>
              </div>

              <div className="pricing-divider" aria-hidden="true" />

              <ul className="mt-6 flex flex-1 flex-col gap-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="pricing-feature">
                    <CheckCircle2 className={`h-4 w-4 ${iconClassName}`} strokeWidth={1.75} />
                    <span className="type-body-md text-[var(--color-on-surface-variant)]">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                to={plan.ctaHref}
                className={[
                  plan.ctaVariant === 'primary' ? 'landing-cta-primary' : 'landing-cta-ghost',
                  'mt-8 w-full justify-center',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {plan.ctaLabel}
              </Link>
            </article>
          );
        })}
      </motion.section>
    </WebsiteLayout>
  );
}
