// Post-subscribe screen.
// TODO: Rebuild for first-100 free digital deck unlock (replaces 50%-off order bump).
// Blocked on product decision for subscriber 101+:
//   (a) deck reverts to regular-price purchase, or
//   (b) deck stays included for all Family Plan subscribers (soft/aspirational cap).
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { openStripeCheckout } from "../lib/stripeCheckout";
import {
  DIGITAL_DECK_PRICE,
  formatDigitalOfferPrice,
  formatDigitalPrice,
} from "../lib/deckPricing";

const css = `
  .ss-page {
    min-height: 100vh;
    background:
      radial-gradient(700px 380px at 50% 0%, var(--terra-tint), transparent 65%),
      var(--paper);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 24px 64px;
    font-family: var(--serif);
    color: var(--ink);
  }
  .ss-card {
    width: 100%;
    max-width: 480px;
    background: var(--paper-card);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-lg);
    padding: 40px 36px 36px;
    text-align: center;
  }
  .ss-mark {
    width: 48px; height: 48px; border-radius: 12px; margin: 0 auto 20px;
    overflow: hidden;
  }
  .ss-mark img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ss-eyebrow {
    font-family: var(--mono); font-size: 11px; letter-spacing: .18em;
    text-transform: uppercase; color: var(--olive-d); margin-bottom: 12px;
  }
  .ss-hl {
    font-family: var(--display); font-size: 34px; font-weight: 600;
    line-height: 1.12; margin: 0 0 14px; letter-spacing: -.015em;
  }
  .ss-hl em { font-style: italic; color: var(--terra); }
  .ss-body {
    font-size: 16px; color: var(--ink-2); line-height: 1.55; margin: 0 0 28px;
  }
  .ss-offer {
    background: var(--terra-tint); border: 1px solid var(--terra-soft);
    border-radius: var(--r); padding: 22px 20px; margin-bottom: 22px; text-align: left;
  }
  .ss-offer-label {
    font-family: var(--mono); font-size: 10.5px; letter-spacing: .14em;
    text-transform: uppercase; color: var(--terra-d); margin-bottom: 8px;
  }
  .ss-offer-title {
    font-family: var(--display); font-size: 22px; font-weight: 600; margin-bottom: 6px;
  }
  .ss-prices { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }
  .ss-prices .now {
    font-family: var(--display); font-size: 36px; font-weight: 600; color: var(--terra);
  }
  .ss-prices .was {
    font-family: var(--mono); font-size: 14px; color: var(--ink-3);
    text-decoration: line-through;
  }
  .ss-today {
    font-family: var(--mono); font-size: 11px; letter-spacing: .08em;
    text-transform: uppercase; color: var(--olive-d);
  }
  .ss-btn {
    width: 100%; font-family: var(--mono); text-transform: uppercase; letter-spacing: .08em;
    font-size: 13px; font-weight: 500; border: none; border-radius: var(--r-sm);
    padding: 16px 22px; cursor: pointer; margin-bottom: 12px;
    background: var(--terra); color: #fff;
    box-shadow: 0 8px 20px rgba(190,90,55,.26);
    transition: background .15s, transform .12s;
  }
  .ss-btn:hover:not(:disabled) { background: var(--terra-d); transform: translateY(-1px); }
  .ss-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; }
  .ss-ghost {
    width: 100%; background: none; border: none; cursor: pointer;
    font-family: var(--serif); font-size: 15px; color: var(--ink-2);
    padding: 10px; text-decoration: underline; text-underline-offset: 3px;
  }
  .ss-ghost:hover { color: var(--terra); }
  .ss-note {
    font-family: var(--mono); font-size: 11px; letter-spacing: .04em;
    color: var(--ink-3); margin-top: 18px;
  }
  .ss-err {
    background: var(--red-tint); border: 1px solid var(--red-soft);
    color: var(--red); border-radius: var(--r-sm); padding: 12px 14px;
    font-size: 14px; margin-bottom: 16px; text-align: left;
  }
`;

export default function SubscribeSuccess({ workspace, onWorkspaceUpdate, onContinue }) {
  const [params] = useSearchParams();
  const parentSessionId = params.get("session_id") || "";
  const [status, setStatus] = useState("loading"); // loading | eligible | ineligible | buying
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      if (workspace?.cards_unlocked) {
        if (active) {
          setStatus("ineligible");
          setReason("already_unlocked");
        }
        return;
      }
      if (!parentSessionId) {
        if (active) {
          setStatus("ineligible");
          setReason("missing_session");
        }
        return;
      }
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("stripe-checkout", {
          body: { action: "verify_deck_offer", parentSessionId },
        });
        if (!active) return;
        if (fnErr || data?.error) {
          setStatus("ineligible");
          setReason(data?.reason || "verify_failed");
          setError(data?.error || fnErr?.message || "");
          return;
        }
        if (data?.cardsUnlocked) {
          onWorkspaceUpdate?.({ ...workspace, cards_unlocked: true });
          setStatus("ineligible");
          setReason("already_unlocked");
          return;
        }
        if (data?.eligible) {
          setStatus("eligible");
        } else {
          setStatus("ineligible");
          setReason(data?.reason || "expired");
        }
      } catch (e) {
        if (!active) return;
        setStatus("ineligible");
        setReason("verify_failed");
        setError(e?.message || String(e));
      }
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentSessionId, workspace?.id, workspace?.cards_unlocked]);

  const buyOffer = async () => {
    setError("");
    setStatus("buying");
    try {
      await openStripeCheckout("digital_offer", {
        parentSessionId,
        successPath: "/app/sync/agenda?checkout=digital_ok",
        cancelPath: `/app/subscribe/success?session_id=${encodeURIComponent(parentSessionId)}`,
      });
    } catch (e) {
      setError(e?.message || "Checkout failed. You can continue into the app.");
      setStatus("eligible");
    }
  };

  const showOffer = status === "eligible" || status === "buying";

  return (
    <div className="ss-page">
      <style>{css}</style>
      <div className="ss-card">
        <div className="ss-mark">
          <img src="/uploads/Logo_4.png" alt="FamilyPause" />
        </div>
        <div className="ss-eyebrow">You&apos;re in</div>
        <h1 className="ss-hl">Your Family Plan is <em>active.</em></h1>
        <p className="ss-body">
          Unlimited AI sessions, spouse sync, and history are unlocked. One more thing before you go.
        </p>

        {status === "loading" && (
          <p className="ss-body" style={{ marginBottom: 8 }}>Checking today&apos;s deck offer…</p>
        )}

        {error && <div className="ss-err">{error}</div>}

        {showOffer && (
          <>
            <div className="ss-offer">
              <div className="ss-offer-label">Today only · Order bump</div>
              <div className="ss-offer-title">2026 Digital Card Deck</div>
              <div className="ss-prices">
                <span className="now">{formatDigitalOfferPrice()}</span>
                <span className="was">{formatDigitalPrice()}</span>
              </div>
              <div className="ss-today">50% off · expires with this checkout</div>
            </div>
            <button type="button" className="ss-btn" onClick={buyOffer} disabled={status === "buying"}>
              {status === "buying" ? "Opening checkout…" : `Unlock the deck, ${formatDigitalOfferPrice()}`}
            </button>
          </>
        )}

        {!showOffer && status !== "loading" && reason === "already_unlocked" && (
          <p className="ss-body">Your card deck is already unlocked. Jump back into your weekly sync.</p>
        )}

        {!showOffer && status !== "loading" && reason !== "already_unlocked" && (
          <p className="ss-body" style={{ fontSize: 15 }}>
            The today-only deck offer isn&apos;t available on this session. You can unlock the digital deck anytime from Cards at {`$${DIGITAL_DECK_PRICE.toFixed(2)}`}.
          </p>
        )}

        <button type="button" className="ss-ghost" onClick={onContinue}>
          No thanks, continue
        </button>
        <p className="ss-note">Physical deck (${24}) stays full price · Digital only</p>
      </div>
    </div>
  );
}
