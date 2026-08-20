/** Stripe Payment Link URLs — env vars override; test defaults below for local/dev. */

const env = import.meta.env || {};

const familyAnnual = (
  env.VITE_STRIPE_FAMILY_ANNUAL
  || "https://buy.stripe.com/test_3cI3cwb7of0m31RcPgcjS00"
).trim();

const familyMonthly = (
  env.VITE_STRIPE_FAMILY_MONTHLY
  || "https://buy.stripe.com/test_eVq3cwdfw6tQ31R16ycjS02"
).trim();

const familyPro = (env.VITE_STRIPE_FAMILY_PRO || "").trim();

const cardDigital = (
  env.VITE_STRIPE_CARD_DIGITAL
  || "https://buy.stripe.com/test_6oUbJ27VcdWi0TJ02ucjS01"
).trim();

const digital12 = (env.VITE_STRIPE_DIGITAL_12 || "").trim();

/** Stripe publishable key (pk_test_… / pk_live_…). Safe for the browser. */
export const STRIPE_PUBLISHABLE_KEY = (env.VITE_STRIPE_PUBLISHABLE_KEY || "").trim();

export const STRIPE_LINKS = {
  /** Family Plan $79/year */
  family: familyAnnual,
  familyAnnual,
  /** Family Plan $9/month */
  familyMonthly,
  pro: familyPro,
  cardDigital,
  /** Onboarding digital upsell — falls back to card digital if not set separately. */
  digital: digital12 || cardDigital,
};

/** Open a Stripe Payment Link in a new browser tab. */
export function openPaymentLink(url) {
  const href = String(url || "").trim();
  if (!href) {
    console.warn("[Stripe] Missing payment link URL");
    return;
  }
  window.open(href, "_blank", "noopener,noreferrer");
}
