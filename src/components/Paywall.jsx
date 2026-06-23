// ─────────────────────────────────────────────────────────────────────────────
// Paywall.jsx: FamilyPause
// Visual source of truth: project/app design bundle (src/styles/tokens.css).
// Shown when the 7-day trial expires, or a free user hits the 1-AI-session/month
// limit and tries to run AI distillation.
//
// Props:
//   reason     "trial" | "limit"  (tailors the headline/subcopy, default "trial")
//   onClose()  optional (dismiss / go back)
//
// Stripe links: VITE_STRIPE_* in .env.local / Vercel (see src/lib/stripeLinks.js).
// ─────────────────────────────────────────────────────────────────────────────

import { STRIPE_LINKS } from "../lib/stripeLinks";

const css = `
  .pw-wrap { max-width: 760px; margin: 0 auto; }
  .pw-head { text-align: center; margin-bottom: 34px; }
  .pw-head .eyebrow { margin-bottom: 12px; }
  .pw-head h1 { font-size: 40px; line-height: 1.06; margin-bottom: 12px; }
  .pw-head h1 em { font-style: italic; color: var(--terra); }
  .pw-head p { color: var(--ink-2); font-size: 16.5px; line-height: 1.55; max-width: 480px; margin: 0 auto; }

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
  .pw-feats { list-style: none; margin: 0 0 24px; padding: 0; display: flex; flex-direction: column; gap: 11px; }
  .pw-feats li { display: flex; gap: 11px; align-items: flex-start; font-size: 14.5px; color: var(--ink); line-height: 1.4; }
  .pw-feats .ck {
    width: 19px; height: 19px; border-radius: 50%; flex: none; margin-top: 1px;
    display: grid; place-items: center; font-size: 11px;
    background: var(--olive-tint); color: var(--olive-d); border: 1px solid var(--olive-soft);
  }
  .pw-cta { margin-top: auto; }
  .pw-foot { text-align: center; margin-top: 26px; }
  .pw-foot .note { font-family: var(--mono); font-size: 11.5px; letter-spacing: .04em; color: var(--ink-3); }
  .pw-foot .pro {
    display: inline-block; margin-top: 14px;
    font-family: var(--mono); font-size: 11.5px; letter-spacing: .05em; text-transform: uppercase;
    color: var(--ink-2); text-decoration: none; border-bottom: 1px dashed var(--line-2); padding-bottom: 2px;
  }
  .pw-foot .pro:hover { color: var(--terra); border-color: var(--terra); }

  @media (max-width: 720px) {
    .pw-grid { grid-template-columns: 1fr; }
    .pw-tagline { min-height: 0; }
  }
`;

function Check() {
  return <span className="ck">✓</span>;
}

export default function Paywall({ reason = "trial", onClose }) {
  const headline = reason === "limit"
    ? <>You've used <em>this month's</em> free session</>
    : reason === "upgrade"
      ? <>Upgrade when <em>you're ready</em></>
      : <>Your <em>free trial</em> has ended</>;
  const sub = reason === "limit"
    ? "The free plan includes one AI session a month. Upgrade to FamilyPause Family for unlimited weekly syncs, and keep your whole family on the same page."
    : reason === "upgrade"
      ? "You're on a free trial with full access. Upgrade anytime for unlimited AI sessions, spouse sync, and session history after your trial ends."
      : "We hope the last 7 days brought a little more calm to your week. Keep the rhythm going with unlimited AI sessions, spouse sync, and full session history.";

  const go = (url) => { if (url) window.location.href = url; };

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
        {onClose && <button className="btn btn-ghost" onClick={onClose}>Not now</button>}
      </div>

      <div className="pw-wrap">
        <div className="pw-head">
          <div className="eyebrow">Keep the rhythm</div>
          <h1>{headline}</h1>
          <p>{sub}</p>
        </div>

        <div className="pw-grid">
          {/* ── FAMILY PLAN, featured ─────────────────────────────────── */}
          <div className="pw-card feat">
            <span className="pw-badge">Most families pick this</span>
            <div className="pw-name">Family Plan</div>
            <div className="pw-price">
              <span className="amt">$59</span>
              <span className="per">/ year</span>
            </div>
            <p className="pw-tagline">Everything your weekly FamilyPause needs, all year.</p>
            <ul className="pw-feats">
              <li><Check /> Unlimited AI meeting sessions</li>
              <li><Check /> Full session history</li>
              <li><Check /> Live spouse sync</li>
              <li><Check /> Kids name routing</li>
            </ul>
            <div className="pw-cta">
              <button className="btn btn-primary btn-lg btn-block" onClick={() => go(STRIPE_LINKS.family)}>
                Upgrade to Family, $59
              </button>
            </div>
          </div>

          {/* ── FREE TIER ─────────────────────────────────────────────── */}
          <div className="pw-card">
            <div className="pw-name">Free</div>
            <div className="pw-price">
              <span className="amt">$0</span>
              <span className="per">/ forever</span>
            </div>
            <p className="pw-tagline">For the occasional reset: one AI session a month.</p>
            <ul className="pw-feats">
              <li><Check /> 1 AI session per month</li>
              <li><Check /> Manual card review anytime</li>
              <li><Check /> Your week organized by person</li>
            </ul>
            <div className="pw-cta">
              <button className="btn btn-ghost btn-block" onClick={() => onClose?.()}>
                {reason === "limit" ? "Wait until next month" : "Stay on Free"}
              </button>
            </div>
          </div>
        </div>

        <div className="pw-foot">
          <div className="note">No credit card required for your trial.</div>
          <a className="pro" href={STRIPE_LINKS.pro} onClick={(e) => { e.preventDefault(); go(STRIPE_LINKS.pro); }}>
            Need recurring-item memory + kids profiles? See Family Pro, $99/yr
          </a>
        </div>
      </div>
    </div>
  );
}
