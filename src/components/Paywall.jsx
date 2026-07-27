// ─────────────────────────────────────────────────────────────────────────────
// Paywall.jsx: FamilyPause
// Trial expiry shows founding / half-off deck offer banner (once per session).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { formatDigitalPrice } from "../lib/deckPricing";
import { openStripeCheckout } from "../lib/stripeCheckout";
import { openPaymentLink, STRIPE_LINKS } from "../lib/stripeLinks";
import { isPaidPlan, isTrialActive } from "../lib/subscription";
import { supabase } from "../lib/supabase";

const OFFER_FLAG = "trial_deck_offer_dismissed";

const css = `
  .pw-wrap { max-width: 760px; margin: 0 auto; }
  .pw-head { text-align: center; margin-bottom: 34px; }
  .pw-head .eyebrow { margin-bottom: 12px; }
  .pw-head h1 { font-size: 40px; line-height: 1.06; margin-bottom: 12px; }
  .pw-head h1 em { font-style: italic; color: var(--terra); }
  .pw-head p { color: var(--ink-2); font-size: 16.5px; line-height: 1.55; max-width: 480px; margin: 0 auto; }

  .pw-offer {
    border-radius: var(--r); padding: 16px 18px; margin-bottom: 18px; text-align: left;
  }
  .pw-offer.free { background: var(--olive-tint); border: 1px solid var(--olive-soft); }
  .pw-offer.half { background: var(--terra-tint); border: 1px solid var(--terra-soft); }
  .pw-offer-eyebrow {
    font-family: var(--mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
    margin: 0 0 8px;
  }
  .pw-offer.free .pw-offer-eyebrow { color: var(--olive-d); }
  .pw-offer.half .pw-offer-eyebrow { color: var(--terra-d); }
  .pw-offer-hl {
    font-family: var(--display); font-style: italic; font-weight: 600;
    font-size: 16px; line-height: 1.35; color: var(--ink); margin: 0;
  }

  .pw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: stretch; }
  .pw-card {
    background: var(--paper-card); border: 1px solid var(--line);
    border-radius: var(--r-lg); padding: 28px 26px;
    box-shadow: var(--shadow-sm); display: flex; flex-direction: column;
  }
  .pw-card.feat {
    border: 1.5px solid var(--terra);
    background: linear-gradient(150deg, #fff, var(--terra-tint));
    box-shadow: var(--shadow);
    position: relative;
  }
  .pw-badge {
    position: absolute; top: -12px; left: 26px;
    background: var(--terra); color: #fff;
    font-family: var(--mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
    padding: 5px 12px; border-radius: 999px; box-shadow: 0 4px 12px rgba(190,90,55,.3);
  }
  .pw-name { font-family: var(--mono); font-size: 11.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 12px; }
  .pw-card.feat .pw-name { color: var(--terra-d); }
  .pw-price { display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px; }
  .pw-price .amt { font-family: var(--display); font-size: 44px; font-weight: 600; color: var(--ink); line-height: 1; }
  .pw-price .per { font-family: var(--mono); font-size: 12px; letter-spacing: .04em; color: var(--ink-3); }
  .pw-tagline { color: var(--ink-2); font-size: 14.5px; line-height: 1.5; margin: 10px 0 18px; min-height: 42px; }
  .pw-includes { margin: 0 0 12px; font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--terra-d); }
  .pw-feats { list-style: none; margin: 0 0 24px; padding: 0; display: flex; flex-direction: column; gap: 11px; }
  .pw-feats li { display: flex; gap: 11px; align-items: flex-start; font-size: 14.5px; color: var(--ink); line-height: 1.4; }
  .pw-feats .ck {
    width: 19px; height: 19px; border-radius: 50%; flex: none; margin-top: 1px;
    display: grid; place-items: center; font-size: 11px;
    background: var(--olive-tint); color: var(--olive-d); border: 1px solid var(--olive-soft);
  }
  .pw-cta { margin-top: auto; display: flex; flex-direction: column; gap: 10px; }
  .pw-cta .btn-monthly {
    font-family: var(--mono); text-transform: uppercase; letter-spacing: .07em;
    font-size: 12px; font-weight: 500; border: 1px solid var(--line-2);
    border-radius: var(--r-sm); padding: 13px 18px; cursor: pointer;
    background: transparent; color: var(--ink-2);
    transition: color .15s, border-color .15s, background .15s;
  }
  .pw-cta .btn-monthly:hover { color: var(--terra); border-color: var(--terra); background: var(--terra-tint); }
  .pw-deck-note {
    font-family: var(--mono); font-size: 10px; letter-spacing: .04em;
    color: var(--ink-3); text-align: center; margin: 0;
  }
  .pw-foot { text-align: center; margin-top: 26px; }
  .pw-foot .note { font-family: var(--mono); font-size: 11.5px; letter-spacing: .04em; color: var(--ink-3); }
  .pw-foot .deck {
    display: inline-block; margin-top: 14px;
    font-family: var(--mono); font-size: 11.5px; letter-spacing: .05em; text-transform: uppercase;
    color: var(--ink-2); text-decoration: none; border-bottom: 1px dashed var(--line-2); padding-bottom: 2px;
    background: none; border-left: none; border-right: none; border-top: none; cursor: pointer;
  }
  .pw-foot .deck:hover { color: var(--terra); border-color: var(--terra); }

  @media (max-width: 720px) {
    .pw-grid { grid-template-columns: 1fr; }
    .pw-tagline { min-height: 0; }
  }
`;

function Check() {
  return <span className="ck">✓</span>;
}

function parseCount(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return parseInt(value, 10) || 0;
  return Number(value) || 0;
}

function offerDismissed() {
  try { return sessionStorage.getItem(OFFER_FLAG) === "1"; } catch { return false; }
}

function dismissOffer() {
  try { sessionStorage.setItem(OFFER_FLAG, "1"); } catch { /* ignore */ }
}

/**
 * @param {{
 *   reason?: "trial"|"daily"|"upgrade",
 *   onClose?: () => void,
 *   workspace?: object,
 *   subscription?: object,
 * }} props
 */
export default function Paywall({ reason = "trial", onClose, workspace, subscription }) {
  const [subscriberCount, setSubscriberCount] = useState(null);
  const [showOffer, setShowOffer] = useState(false);

  const headline = reason === "daily"
    ? <>You&apos;ve used <em>today&apos;s</em> free session</>
    : reason === "upgrade"
      ? <>Upgrade when <em>you&apos;re ready</em></>
      : <>Your <em>free trial</em> has ended</>;

  const sub = reason === "daily"
    ? "You've used today's free session. Come back tomorrow, or upgrade for unlimited sessions."
    : reason === "upgrade"
      ? "Unlock editing, missing-time resolution, exports, unlimited plans, and spouse sync with Family Plan."
      : "We hope the last 7 days brought a little more calm to your week. Keep the rhythm going with editing, exports, unlimited plans, and spouse sync.";

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "subscriber_count")
        .maybeSingle();
      if (!active) return;
      setSubscriberCount(parseCount(data?.value));
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const trialExpiry = reason === "trial";
    const eligible = trialExpiry
      && !isPaidPlan(subscription)
      && !isTrialActive(subscription)
      && !workspace?.cards_unlocked
      && !offerDismissed();
    setShowOffer(!!eligible && subscriberCount !== null);
  }, [reason, subscription, workspace?.cards_unlocked, subscriberCount]);

  const handleClose = () => {
    if (showOffer) dismissOffer();
    onClose?.();
  };

  const foundingFree = showOffer && subscriberCount !== null && subscriberCount < 100;
  const halfOff = showOffer && subscriberCount !== null && subscriberCount >= 100;

  const startCheckout = (product) => {
    void openStripeCheckout(product, {
      successPath: "/subscribe/success?session_id={CHECKOUT_SESSION_ID}",
      cancelPath: "/subscribe/cancel",
      includeTrialDeckOffer: showOffer,
    });
  };

  return (
    <div className="stage view">
      <style>{css}</style>

      <div className="brandbar">
        <div className="brand">
          <div className="mark">
            <img src="/uploads/Logo_4.png" alt="FamilyPause"
                 style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" }} />
          </div>
          <div className="word"><b>Family</b><span>Pause</span></div>
        </div>
        {onClose && <button className="btn btn-ghost" onClick={handleClose}>Not now</button>}
      </div>

      <div className="pw-wrap">
        <div className="pw-head">
          <div className="eyebrow">Keep the rhythm</div>
          <h1>{headline}</h1>
          <p>{sub}</p>
        </div>

        {foundingFree && (
          <div className="pw-offer free" role="status">
            <div className="pw-offer-eyebrow">Founding Member Offer</div>
            <p className="pw-offer-hl">Get the full digital card deck free when you become a member today.</p>
          </div>
        )}
        {halfOff && (
          <div className="pw-offer half" role="status">
            <div className="pw-offer-eyebrow">Trial Member Offer</div>
            <p className="pw-offer-hl">Get the full digital card deck at half off when you upgrade today.</p>
          </div>
        )}

        <div className="pw-grid">
          <div className="pw-card feat">
            <span className="pw-badge">Most families pick this</span>
            <div className="pw-name">Family Plan</div>
            <div className="pw-price">
              <span className="amt">$59</span>
              <span className="per">/ year</span>
            </div>
            <p className="pw-tagline">Everything your weekly FamilyPause needs, all year. Or $7/month.</p>
            <p className="pw-includes">Everything in Free, plus:</p>
            <ul className="pw-feats">
              <li><Check /> Edit titles, dates, times, and family members</li>
              <li><Check /> Resolve missing dates and times inline</li>
              <li><Check /> Create unlimited plans</li>
              <li><Check /> Access your complete plan history</li>
              <li><Check /> Invite your spouse with real-time syncing</li>
              <li><Check /> Organize with family members and custom categories</li>
              <li><Check /> Print or download your plan and itinerary as a PDF</li>
              <li><Check /> Export to Notion, Slack, or anywhere as a formatted list</li>
              <li><Check /> Unlock the complete digital Conversation Card Deck (free for the first 100 subscribers)</li>
            </ul>
            <div className="pw-cta">
              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                onClick={() => startCheckout("family")}
              >
                Upgrade Annual, $59/year
              </button>
              {foundingFree && (
                <p className="pw-deck-note">Digital card deck included free — today only.</p>
              )}
              {halfOff && (
                <p className="pw-deck-note">Digital Deck: $4.99 (half off today only)</p>
              )}
              <button
                type="button"
                className="btn-monthly"
                onClick={() => startCheckout("family_monthly")}
              >
                Or Monthly, $7/month
              </button>
            </div>
          </div>

          <div className="pw-card">
            <div className="pw-name">Free</div>
            <div className="pw-price">
              <span className="amt">$0</span>
              <span className="per">/ forever</span>
            </div>
            <p className="pw-tagline">Everything you need to keep creating family plans after your trial.</p>
            <ul className="pw-feats">
              <li><Check /> Type, paste, or record what needs planning</li>
              <li><Check /> One plan per day</li>
              <li><Check /> Review extracted items before they are scheduled</li>
              <li><Check /> Add approved items to your calendar</li>
              <li><Check /> View your week as a simple itinerary</li>
              <li><Check /> Copy your plan as text into any app</li>
              <li><Check /> 7 free Conversation Starter Cards</li>
            </ul>
            <div className="pw-cta">
              <button className="btn btn-ghost btn-block" onClick={handleClose}>
                {reason === "daily" ? "Come back tomorrow" : "Stay on Free"}
              </button>
            </div>
          </div>
        </div>

        <div className="pw-foot">
          <div className="note">Secure checkout via Stripe</div>
          <button
            type="button"
            className="deck"
            onClick={() => openPaymentLink(STRIPE_LINKS.cardDigital || STRIPE_LINKS.digital)}
          >
            Buy Digital Card Deck, {formatDigitalPrice()}
          </button>
        </div>
      </div>
    </div>
  );
}
