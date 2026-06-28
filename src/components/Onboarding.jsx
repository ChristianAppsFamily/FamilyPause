import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { onboardingPath } from "../lib/routes";
import { openStripeCheckout } from "../lib/stripeCheckout";
import "../styles/onboarding.css";
const PHYSICAL_DECK_URL = "https://familypause.com/cards";
const TOTAL = 5;

function ProgressBar({ step }) {
  return (
    <div className="ob-progress">
      {Array.from({ length: TOTAL }).map((_, i) => (
        <div key={i} className={`ob-seg${i < step ? " filled" : ""}`} />
      ))}
    </div>
  );
}

function StepWelcome({ displayName, onNext }) {
  return (
    <div>
      <ProgressBar step={1} />
      <div className="ob-anim ob-center" style={{ "--d": "0ms" }}><div className="ob-big-emoji">👋</div></div>
      <div className="ob-anim ob-center" style={{ "--d": "70ms" }}><div className="ob-eyebrow">You're In</div></div>
      <h1 className="ob-anim ob-hl ob-center" style={{ "--d": "140ms" }}>
        Welcome to FamilyPause,<br /><em>{displayName}</em>
      </h1>
      <p className="ob-anim ob-body ob-center" style={{ "--d": "210ms" }}>
        You have 7 days of full access, starting now. Spend two minutes setting up your workspace so your first session is ready to go.
      </p>
      <div className="ob-anim ob-gold-box" style={{ "--d": "280ms" }}>
        <div className="ob-eyebrow-mut">Your 7-Day Trial Includes</div>
        <div className="ob-feat-list">
          {[
            "Unlimited AI meeting sessions",
            "Full session history",
            "Invite your spouse to your workspace",
            "Keep / Discard calendar review flow",
            "Google Calendar integration",
          ].map((f) => (
            <div key={f} className="ob-feat"><span className="ob-arr">→</span><span>{f}</span></div>
          ))}
        </div>
      </div>
      <div className="ob-anim" style={{ "--d": "350ms" }}>
        <button type="button" className="ob-btn-primary" onClick={onNext}>Set Up My Family Workspace →</button>
      </div>
    </div>
  );
}

function StepFamilySetup({ workspaceId, displayName, onNext }) {
  const [spouseName, setSpouseName] = useState("");
  const [kidInput, setKidInput] = useState("");
  const [kids, setKids] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [bizInput, setBizInput] = useState("");
  const [loading, setLoading] = useState(false);

  const addKid = () => {
    const name = kidInput.trim();
    if (name && !kids.includes(name)) setKids([...kids, name]);
    setKidInput("");
  };
  const addBiz = () => {
    const name = bizInput.trim();
    if (name && !businesses.includes(name)) setBusinesses([...businesses, name]);
    setBizInput("");
  };

  const handleSave = async () => {
    setLoading(true);
    const people = [displayName, spouseName].filter(Boolean);
    await supabase.from("workspaces").update({
      family_context: {
        people: [...people, ...kids],
        kids,
        businesses,
        categories: ["Family", "Kids", "Business", "Finance", "Home", "Faith", "Health", "Dates"],
      },
    }).eq("id", workspaceId);
    setLoading(false);
    onNext({ spouseName, kids, businesses });
  };

  return (
    <div>
      <ProgressBar step={2} />
      <div className="ob-anim" style={{ "--d": "0ms" }}><div className="ob-eyebrow">Step 2 of 5</div></div>
      <h1 className="ob-anim ob-hl" style={{ "--d": "70ms" }}>Tell us about <em>your family</em></h1>
      <p className="ob-anim ob-body" style={{ "--d": "140ms" }}>
        FamilyPause uses these names to route action items and appointments to the right person — automatically.
      </p>

      <div className="ob-anim ob-field-block" style={{ "--d": "210ms", marginTop: 28 }}>
        <label className="ob-field-label" htmlFor="ob-spouse">Your spouse or partner's name</label>
        <input id="ob-spouse" className="ob-text-input" type="text" placeholder="First Name" value={spouseName} onChange={(e) => setSpouseName(e.target.value)} />
      </div>

      <div className="ob-anim ob-field-block" style={{ "--d": "280ms" }}>
        <label className="ob-field-label" htmlFor="ob-kid">Kids' names <span className="opt">Optional</span></label>
        <div className="ob-input-row">
          <input id="ob-kid" className="ob-text-input" type="text" placeholder="Add a child's name" value={kidInput}
            onChange={(e) => setKidInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKid())} />
          <button type="button" className="ob-add-btn" onClick={addKid}>Add</button>
        </div>
        {kids.length > 0 && (
          <div className="ob-chips">
            {kids.map((k) => (
              <div key={k} className="ob-chip">{k}<button type="button" className="ob-chip-x" onClick={() => setKids(kids.filter((x) => x !== k))}>×</button></div>
            ))}
          </div>
        )}
      </div>

      <div className="ob-anim ob-field-block" style={{ "--d": "350ms" }}>
        <label className="ob-field-label" htmlFor="ob-biz">Business or project names <span className="opt">Optional</span></label>
        <div className="ob-input-row">
          <input id="ob-biz" className="ob-text-input" type="text" placeholder="Add a business or project" value={bizInput}
            onChange={(e) => setBizInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBiz())} />
          <button type="button" className="ob-add-btn" onClick={addBiz}>Add</button>
        </div>
        {businesses.length > 0 && (
          <div className="ob-chips">
            {businesses.map((b) => (
              <div key={b} className="ob-chip">{b}<button type="button" className="ob-chip-x" onClick={() => setBusinesses(businesses.filter((x) => x !== b))}>×</button></div>
            ))}
          </div>
        )}
        <p className="ob-field-note">Names you mention in sessions will be recognized and tagged by the AI.</p>
      </div>

      <div className="ob-anim" style={{ "--d": "420ms" }}>
        <button type="button" className="ob-btn-primary" onClick={handleSave} disabled={loading}>{loading ? "Saving…" : "Save and Continue"}</button>
      </div>
    </div>
  );
}

function IconLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function IconText() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function StepInvite({ workspaceId, spouseName, inviteCode: initialInviteCode, onNext }) {
  const [inviteCode, setInviteCode] = useState(initialInviteCode || null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(!initialInviteCode);

  useEffect(() => {
    if (initialInviteCode) setInviteCode(initialInviteCode);
    supabase.from("workspaces").select("invite_code").eq("id", workspaceId).single()
      .then(({ data }) => {
        if (data?.invite_code) setInviteCode(data.invite_code);
      })
      .finally(() => setLoading(false));
  }, [workspaceId, initialInviteCode]);

  const inviteLink = inviteCode ? `${window.location.origin}/join/${inviteCode}` : "";
  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  const smsLink = `sms:?body=${encodeURIComponent(
    spouseName
      ? `Hey ${spouseName}, join my FamilyPause workspace so we can plan our week together! ${inviteLink}`
      : `Join my FamilyPause workspace! ${inviteLink}`
  )}`;

  return (
    <div>
      <ProgressBar step={3} />
      <div className="ob-anim" style={{ "--d": "0ms" }}><div className="ob-eyebrow">Step 3 of 5</div></div>
      <h1 className="ob-anim ob-hl" style={{ "--d": "70ms" }}>
        Invite {spouseName || "your spouse"} <em>to your workspace</em>
      </h1>
      <p className="ob-anim ob-body" style={{ "--d": "140ms" }}>
        You'll share the same sessions, plans, and history — updated in real time, on both your phones.
      </p>

      {loading ? (
        <div className="ob-spin" />
      ) : (
        <>
          <div className="ob-anim ob-invite-card" style={{ "--d": "210ms" }}>
            <div className="ob-eyebrow-mut">Your Invite Link</div>
            <div className="ob-invite-row">
              <input className="ob-invite-field" readOnly value={inviteLink.replace(/^https?:\/\//, "")} />
              <button type="button" className={`ob-copy-btn${copied ? " copied" : ""}`} onClick={copyLink}>{copied ? "Copied" : "Copy"}</button>
            </div>
          </div>
          <div className="ob-anim ob-share-grid" style={{ "--d": "280ms" }}>
            <a className="ob-share-btn olive" href={smsLink}><IconText /> Send via Text</a>
            <button type="button" className="ob-share-btn surface" onClick={copyLink}><IconLink /> Copy Link</button>
          </div>
          <div className="ob-anim ob-code-hint" style={{ "--d": "350ms" }}>
            <div className="ob-eyebrow-mut">Or Share This Code</div>
            <div className="ob-code-big">{inviteCode}</div>
            <p className="ob-field-note" style={{ marginTop: 0 }}>{spouseName || "They"} can enter this code manually when signing up.</p>
          </div>
        </>
      )}

      <div className="ob-anim" style={{ "--d": "420ms" }}>
        <button type="button" className="ob-btn-primary" onClick={onNext}>Continue</button>
        <button type="button" className="ob-btn-ghost" onClick={onNext}>Skip for now — invite later from Settings</button>
      </div>
    </div>
  );
}

function StepReady({ onNext }) {
  return (
    <div className="ob-center">
      <ProgressBar step={4} />
      <div className="ob-anim" style={{ "--d": "0ms" }}>
        <div className="ob-success-circle">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#FBF6EC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        </div>
      </div>
      <div className="ob-anim" style={{ "--d": "160ms" }}><div className="ob-eyebrow">You're All Set</div></div>
      <h1 className="ob-anim ob-hl" style={{ "--d": "230ms" }}>Ready for your <em>first FamilyPause</em></h1>
      <p className="ob-anim ob-body" style={{ "--d": "300ms" }}>Here's how a session works. Sit down together, and let the app handle the rest.</p>
      <div className="ob-anim ob-how-card" style={{ "--d": "370ms" }}>
        {[
          ["🎙️", "Record your conversation live"],
          ["📋", "Or paste a transcript from Otter"],
          ["✅", "Review cards together — Keep or Discard"],
          ["📅", "Send appointments to Google Calendar"],
        ].map(([emoji, text]) => (
          <div key={text} className="ob-how-row"><span className="ob-how-emoji">{emoji}</span><span>{text}</span></div>
        ))}
      </div>
      <div className="ob-anim" style={{ "--d": "440ms" }}>
        <button type="button" className="ob-btn-primary" onClick={onNext}>Continue →</button>
      </div>
    </div>
  );
}

function StepCardDeck({ workspaceId, onComplete }) {
  const [tab, setTab] = useState("code");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const finish = async () => {
    setSkipping(true);
    try {
      await onComplete();
    } finally {
      setSkipping(false);
    }
  };

  const redeem = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError("Please enter your code."); return; }
    setLoading(true); setError("");
    const { data, error: lookupErr } = await supabase.from("deck_codes").select("id, deck_year, redeemed_by").eq("code", trimmed).maybeSingle();
    if (lookupErr || !data) { setError("Code not found. Check the card inside your box lid."); setLoading(false); return; }
    if (data.redeemed_by) { setError("This code has already been redeemed."); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error: redeemErr } = await supabase.from("deck_codes").update({ redeemed_by: user?.id, redeemed_at: new Date().toISOString() }).eq("id", data.id);
    if (redeemErr) { setError("Redemption failed. Try again or skip and do it in Settings."); setLoading(false); return; }
    const { data: ws } = await supabase.from("workspaces").select("unlocked_deck_years").eq("id", workspaceId).single();
    const years = [...new Set([...(ws?.unlocked_deck_years || []), data.deck_year || 2026])];
    await supabase.from("workspaces").update({ cards_unlocked: true, unlocked_deck_years: years }).eq("id", workspaceId);
    setUnlocked(true);
    setLoading(false);
    setTimeout(onComplete, 1600);
  };

  return (
    <div>
      <ProgressBar step={5} />
      <div className="ob-anim" style={{ "--d": "0ms" }}><div className="ob-eyebrow">Step 5 of 5 · Conversation Starter</div></div>
      <h1 className="ob-anim ob-hl" style={{ "--d": "70ms" }}>Add your <em>card deck</em></h1>
      <p className="ob-anim ob-body" style={{ "--d": "140ms", marginBottom: 28 }}>
        52 weekly questions that go deeper than the to-do list — a conversation starter for couples before every sync.
      </p>

      {unlocked ? (
        <div className="ob-unlocked">
          <div style={{ fontSize: 24, marginBottom: 6 }}>✓</div>
          <div className="ob-eyebrow-mut" style={{ color: "var(--olive-d)" }}>Deck unlocked</div>
        </div>
      ) : (
        <>
          <div className="ob-anim ob-tab-sw" style={{ "--d": "210ms" }}>
            <button type="button" className={tab === "code" ? "active" : ""} onClick={() => setTab("code")}>I have the deck</button>
            <button type="button" className={tab === "dig" ? "active" : ""} onClick={() => setTab("dig")}>Buy digital $12</button>
          </div>

          {tab === "code" ? (
            <div className="ob-anim" style={{ "--d": "280ms" }}>
              <div className="ob-eyebrow-mut" style={{ marginBottom: 8 }}>Deck Code</div>
              {error && <div className="ob-error">{error}</div>}
              <input
                className="ob-code-input"
                placeholder="FP-2026-XXXX-0000"
                maxLength={18}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && redeem()}
              />
              <p className="ob-field-note" style={{ marginTop: 10, marginBottom: 20 }}>Found inside the lid of your FamilyPause Card Deck box</p>
              <button type="button" className="ob-btn-primary" onClick={redeem} disabled={loading} style={{ marginBottom: 16 }}>
                {loading ? "Unlocking…" : "Unlock My Cards"}
              </button>
              <div className="ob-info-gold">
                <div className="ob-deck-callout">Don't Have the Deck Yet?</div>
                <p className="ob-body" style={{ fontSize: 14 }}>
                  Get the physical card deck at <strong>familypause.com/cards</strong> for $24 — includes all 52 cards and unlocks this digital feature.
                </p>
              </div>
              <a
                href={PHYSICAL_DECK_URL}
                target="_blank"
                rel="noreferrer"
                className="ob-btn-primary"
                style={{ marginTop: 16, textDecoration: "none" }}
              >
                Purchase Physical Deck — $24
              </a>
            </div>
          ) : (
            <div className="ob-anim" style={{ "--d": "280ms" }}>
              <div className="ob-dig-card">
                <div className="ob-dig-hdr">
                  <div>
                    <div style={{ fontFamily: "var(--display)", fontSize: 20, marginBottom: 5 }}>2026 Digital Card Set</div>
                    <div className="ob-eyebrow-mut">52 cards · Permanent access · No expiration</div>
                  </div>
                  <div style={{ fontFamily: "var(--display)", fontSize: 28, color: "var(--terra)", flex: "none" }}>$12</div>
                </div>
              </div>
              <div className="ob-feat-list" style={{ marginBottom: 20 }}>
                {[
                  "52 weekly conversation prompts",
                  "Organized across 6 categories",
                  "Card draw feature unlocked permanently",
                  "Both spouses get access instantly",
                ].map((f) => (
                  <div key={f} className="ob-feat"><span className="ob-arr">→</span><span>{f}</span></div>
                ))}
              </div>
              <button
                type="button"
                className="ob-btn-primary"
                style={{ marginBottom: 12, width: "100%" }}
                onClick={() => openStripeCheckout("digital", { successPath: "/app?checkout=success" })}
              >
                Purchase Digital Access — $12
              </button>
              <p className="ob-field-note ob-center" style={{ marginBottom: 16 }}>Secure payment via Stripe · Instant access</p>
              <div className="ob-info-terra">
                <p className="ob-body" style={{ fontSize: 13, color: "var(--terra-d)" }}>
                  The physical deck at $24 includes this digital unlock — plus 52 beautifully printed cards for your table.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <div className="ob-anim" style={{ "--d": "420ms", marginTop: 24 }}>
        <button type="button" className="ob-btn-ghost" onClick={finish} disabled={skipping || loading}>
          {skipping
            ? "Opening FamilyPause…"
            : unlocked
              ? "Start My First FamilyPause →"
              : "Skip for now — unlock later in Settings"}
        </button>
      </div>
    </div>
  );
}

export default function Onboarding({ workspaceId, displayName, inviteCode, joined, onComplete }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [familyData, setFamilyData] = useState({});

  const stepFromUrl = () => {
    const m = location.pathname.match(/\/app\/onboarding\/(\d+)/);
    const n = m ? parseInt(m[1], 10) : 1;
    return Math.min(5, Math.max(1, n || 1));
  };

  const step = stepFromUrl();

  const goToStep = (next, { replace = false } = {}) => {
    const s = Math.min(5, Math.max(1, next));
    navigate(onboardingPath(s), { replace });
  };

  return (
    <div className="ob-page">
      <div className="ob-column">
        {step === 1 && (
          <StepWelcome displayName={displayName} onNext={() => goToStep(joined ? 4 : 2)} />
        )}
        {step === 2 && (
          <StepFamilySetup workspaceId={workspaceId} displayName={displayName}
            onNext={(data) => { setFamilyData(data); goToStep(3); }} />
        )}
        {step === 3 && (
          <StepInvite workspaceId={workspaceId} spouseName={familyData.spouseName} inviteCode={inviteCode} onNext={() => goToStep(4)} />
        )}
        {step === 4 && (
          <StepReady onNext={() => goToStep(5)} />
        )}
        {step === 5 && (
          <StepCardDeck workspaceId={workspaceId} onComplete={onComplete} />
        )}
      </div>
    </div>
  );
}
