/** Stripe Payment Link URLs — set in Vercel / .env.local before launch. */

const familyAnnual = (import.meta.env.VITE_STRIPE_FAMILY_ANNUAL || "").trim();
const familyPro = (import.meta.env.VITE_STRIPE_FAMILY_PRO || "").trim();
const cardDigital = (import.meta.env.VITE_STRIPE_CARD_DIGITAL || "").trim();
const digital12 = (import.meta.env.VITE_STRIPE_DIGITAL_12 || "").trim();

export const STRIPE_LINKS = {
  family: familyAnnual,
  pro: familyPro,
  cardDigital,
  /** Onboarding digital upsell — falls back to card digital if not set separately. */
  digital: digital12 || cardDigital,
};
