// ─────────────────────────────────────────────────────────────────────────────
// Onboarding.jsx — FamilyPause
// Screens: Welcome, Family Setup, Invite Spouse, Ready
// Drop into: src/components/Onboarding.jsx
// Requires: src/lib/supabase.js
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { supabase } from "../lib/supabase";

// Palette mapped to the design bundle (src/styles/tokens.css) — source of truth.
const T = {
  bg:      "#FBF6EC",  // --paper
  surface: "#FCF8F0",  // --paper-card
  surface2:"#F4EAD8",  // --paper-2
  border:  "#E6D9C4",  // --line
  text:    "#2A251D",  // --ink
  mid:     "#5B5245",  // --ink-2
  muted:   "#8C8070",  // --ink-3
  terra:   "#BE5A37",  // --terra
  terraL:  "#FAEAE0",  // --terra-tint
  terraD:  "#A2481F",  // --terra-d
  olive:   "#5E6B37",  // --olive
  oliveL:  "#EDF0E1",  // --olive-tint
  gold:    "#C09740",  // --gold
  goldL:   "#F0E3C0",  // --gold-soft
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes checkPop {
    0%   { transform: scale(0); opacity: 0; }
    60%  { transform: scale(1.2); }
    100% { transform: scale(1); opacity: 1; }
  }
  .ob-fade   { animation: fadeUp 0.5s ease both; }
  .ob-fade-1 { animation: fadeUp 0.5s 0.08s ease both; }
  .ob-fade-2 { animation: fadeUp 0.5s 0.16s ease both; }
  .ob-fade-3 { animation: fadeUp 0.5s 0.24s ease both; }
  .ob-fade-4 { animation: fadeUp 0.5s 0.32s ease both; }
  .ob-input {
    width: 100%;
    background: ${T.bg};
    border: 1px solid ${T.border};
    border-radius: 8px;
    color: ${T.text};
    padding: 12px 16px;
    font-size: 15px;
    font-family: 'Lora', serif;
    transition: border-color 0.2s, box-shadow 0.2s;
    outline: none;
  }
  .ob-input:focus {
    border-color: ${T.terra};
    box-shadow: 0 0 0 3px ${T.terraL};
  }
  .ob-input::placeholder { color: ${T.muted}; }
  /* Onboarding prototype uses Lora sentence-case primary buttons (not the app's mono). */
  .ob-btn {
    width: 100%;
    background: ${T.terra};
    color: #fff;
    border: none; border-radius: 8px;
    padding: 14px; font-size: 16px;
    font-family: 'Lora', serif; font-weight: 500;
    cursor: pointer; transition: all 0.2s;
    box-shadow: 0 4px 16px rgba(190,90,55,0.25);
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .ob-btn:hover:not(:disabled) {
    background: ${T.terraD};
    transform: translateY(-1px);
  }
  .ob-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .ob-btn-ghost {
    width: 100%; background: none;
    border: 1px solid ${T.border};
    border-radius: 8px; color: ${T.mid};
    padding: 12px; font-size: 14px;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.05em; cursor: pointer;
    transition: all 0.2s;
  }
  .ob-btn-ghost:hover { border-color: ${T.terra}; color: ${T.terra}; }
  .ob-label {
    display: block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px; letter-spacing: 0.12em;
    text-transform: uppercase; color: ${T.mid};
    margin-bottom: 7px;
  }
  .ob-tag {
    display: inline-flex; align-items: center; gap: 6px;
    background: ${T.terraL}; color: ${T.terraD};
    padding: 4px 10px 4px 12px;
    border-radius: 20px; font-size: 13px;
    font-family: 'Lora', serif;
  }
  .ob-tag button {
    background: none; border: none; cursor: pointer;
    color: ${T.terra}; font-size: 16px; line-height: 1;
    padding: 0; transition: color 0.15s;
  }
  .ob-tag button:hover { color: ${T.terraD}; }
  .copy-btn {
    background: ${T.surface}; border: 1px solid ${T.border};
    border-radius: 6px; color: ${T.mid};
    padding: 8px 14px; font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.05em; cursor: pointer;
    transition: all 0.2s; white-space: nowrap;
    flex-shrink: 0;
  }
  .copy-btn:hover { background: ${T.terraL}; border-color: ${T.terra}; color: ${T.terraD}; }
  .copy-btn.copied { background: ${T.oliveL}; border-color: ${T.olive}; color: ${T.olive}; }
`;

// ── PROGRESS BAR ──────────────────────────────────────────────────────────────
function ProgressBar({ step, total }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 48 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 3, borderRadius: 2,
          background: i < step ? T.terra : T.border,
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );
}

// ── STEP 1: WELCOME ───────────────────────────────────────────────────────────
function StepWelcome({ displayName, onNext }) {
  return (
    <div>
      <ProgressBar step={1} total={4} />

      <div style={{ fontSize: 52, marginBottom: 20 }}>👋</div>

      <div className="ob-fade" style={{ fontSize: 11, letterSpacing: "0.25em", color: T.terra, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", marginBottom: 12 }}>
        You're in
      </div>
      <h2 className="ob-fade-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 400, color: T.text, marginBottom: 16, lineHeight: 1.2 }}>
        Welcome to FamilyPause,<br /><em style={{ color: T.terra }}>{displayName}.</em>
      </h2>
      <p className="ob-fade-2" style={{ fontSize: 16, color: T.mid, lineHeight: 1.65, marginBottom: 40, maxWidth: 420 }}>
        You have 7 days of full access, free. Let's take 2 minutes to set up your family workspace so the AI knows who you're talking about.
      </p>

      <div className="ob-fade-3" style={{ background: T.goldL, border: `1px solid ${T.gold}44`, borderRadius: 12, padding: "20px 24px", marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: T.gold, letterSpacing: "0.1em", marginBottom: 8 }}>YOUR 7-DAY TRIAL INCLUDES</div>
        {["Unlimited AI meeting sessions", "Full session history", "Invite your spouse to your workspace", "Keep / Discard / Calendar review flow", "Google Calendar integration"].map(f => (
          <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
            <span style={{ color: T.terra, marginTop: 2 }}>→</span>
            <span style={{ fontSize: 14, color: T.mid }}>{f}</span>
          </div>
        ))}
      </div>

      <button className="ob-btn ob-fade-4" onClick={onNext}>
        Set Up My Family Workspace →
      </button>
    </div>
  );
}

// ── STEP 2: FAMILY SETUP ──────────────────────────────────────────────────────
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

  const handleKey = (setter, adder) => (e) => {
    if (e.key === "Enter") { e.preventDefault(); adder(); }
  };

  const handleSave = async () => {
    setLoading(true);
    const people = [displayName, spouseName].filter(Boolean);
    const context = {
      people: [...people, ...kids],
      kids,
      businesses,
      categories: ["Family", "Kids", "Business", "Finance", "Home", "Faith", "Health", "Dates"],
    };

    await supabase.from("workspaces")
      .update({ family_context: context })
      .eq("id", workspaceId);

    setLoading(false);
    onNext({ spouseName, kids, businesses });
  };

  return (
    <div>
      <ProgressBar step={2} total={4} />

      <div className="ob-fade" style={{ fontSize: 11, letterSpacing: "0.25em", color: T.terra, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", marginBottom: 12 }}>
        Step 2 of 4
      </div>
      <h2 className="ob-fade-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 400, color: T.text, marginBottom: 8 }}>
        Tell us about<br /><em style={{ color: T.terra }}>your family.</em>
      </h2>
      <p className="ob-fade-2" style={{ fontSize: 15, color: T.mid, marginBottom: 36, lineHeight: 1.6 }}>
        The AI uses these names to route action items to the right person automatically. You can always update these later in Settings.
      </p>

      {/* Spouse name */}
      <div className="ob-fade-2" style={{ marginBottom: 24 }}>
        <label className="ob-label">Your spouse or partner's name</label>
        <input className="ob-input" type="text" placeholder="Amanda"
          value={spouseName} onChange={e => setSpouseName(e.target.value)} />
      </div>

      {/* Kids */}
      <div className="ob-fade-3" style={{ marginBottom: 24 }}>
        <label className="ob-label">Kids' names (optional)</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input className="ob-input" type="text" placeholder="Add a child's name, press Enter"
            value={kidInput} onChange={e => setKidInput(e.target.value)}
            onKeyDown={handleKey(setKidInput, addKid)} />
          <button onClick={addKid} style={{
            background: T.terraL, border: `1px solid ${T.terra}44`,
            borderRadius: 8, color: T.terraD, padding: "0 16px",
            cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13, flexShrink: 0, transition: "all 0.15s",
          }}>Add</button>
        </div>
        {kids.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {kids.map(k => (
              <div key={k} className="ob-tag">
                {k}
                <button onClick={() => setKids(kids.filter(x => x !== k))}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Businesses */}
      <div className="ob-fade-4" style={{ marginBottom: 36 }}>
        <label className="ob-label">Business or project names (optional)</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input className="ob-input" type="text" placeholder="e.g. Christian App Empire"
            value={bizInput} onChange={e => setBizInput(e.target.value)}
            onKeyDown={handleKey(setBizInput, addBiz)} />
          <button onClick={addBiz} style={{
            background: T.terraL, border: `1px solid ${T.terra}44`,
            borderRadius: 8, color: T.terraD, padding: "0 16px",
            cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13, flexShrink: 0, transition: "all 0.15s",
          }}>Add</button>
        </div>
        {businesses.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {businesses.map(b => (
              <div key={b} className="ob-tag">
                {b}
                <button onClick={() => setBusinesses(businesses.filter(x => x !== b))}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11, color: T.muted, fontFamily: "'JetBrains Mono', monospace", marginTop: 8 }}>
          If you mention these in your meeting the AI will recognize them and categorize correctly.
        </div>
      </div>

      <button className="ob-btn" onClick={handleSave} disabled={loading}>
        {loading ? "Saving..." : "Save & Continue →"}
      </button>
    </div>
  );
}

// ── STEP 3: INVITE SPOUSE ─────────────────────────────────────────────────────
function StepInvite({ workspaceId, spouseName, onNext }) {
  const [inviteCode, setInviteCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch the invite code
  useState(() => {
    supabase.from("workspaces")
      .select("invite_code")
      .eq("id", workspaceId)
      .single()
      .then(({ data }) => {
        if (data) setInviteCode(data.invite_code);
        setLoading(false);
      });
  });

  const inviteLink = inviteCode
    ? `${window.location.origin}/join/${inviteCode}`
    : "";

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareText = spouseName
    ? `Hey ${spouseName}, join my FamilyPause workspace so we can plan our week together! ${inviteLink}`
    : `Join my FamilyPause workspace! ${inviteLink}`;

  const smsLink = `sms:?body=${encodeURIComponent(shareText)}`;

  return (
    <div>
      <ProgressBar step={3} total={4} />

      <div className="ob-fade" style={{ fontSize: 11, letterSpacing: "0.25em", color: T.terra, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", marginBottom: 12 }}>
        Step 3 of 4
      </div>
      <h2 className="ob-fade-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 400, color: T.text, marginBottom: 8 }}>
        Invite{spouseName ? ` ${spouseName}` : " your spouse"}<br /><em style={{ color: T.terra }}>to your workspace.</em>
      </h2>
      <p className="ob-fade-2" style={{ fontSize: 15, color: T.mid, marginBottom: 36, lineHeight: 1.6 }}>
        Share this link and they'll join your family workspace instantly. You'll both see the same sessions, plans, and history in real time.
      </p>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <div style={{ width: 32, height: 32, border: `2px solid ${T.border}`, borderTopColor: T.terra, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : (
        <>
          {/* Invite link box */}
          <div className="ob-fade-3" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px 20px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: T.muted, letterSpacing: "0.1em", marginBottom: 10 }}>YOUR INVITE LINK</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{
                flex: 1, background: T.bg, border: `1px solid ${T.border}`,
                borderRadius: 6, padding: "10px 14px",
                fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                color: T.mid, overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {inviteLink}
              </div>
              <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={copyLink}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Share options */}
          <div className="ob-fade-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 32 }}>
            <a href={smsLink} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: T.oliveL, border: `1px solid ${T.olive}44`,
              borderRadius: 10, padding: "14px", textDecoration: "none",
              color: T.olive, fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, letterSpacing: "0.05em", transition: "all 0.2s",
            }}>
              💬 Send via Text
            </a>
            <button onClick={copyLink} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: "14px",
              color: T.mid, fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, letterSpacing: "0.05em", cursor: "pointer",
              transition: "all 0.2s",
            }}>
              🔗 Copy Link
            </button>
          </div>

          <div className="ob-fade-4" style={{ background: T.goldL, border: `1px solid ${T.gold}33`, borderRadius: 10, padding: "14px 18px", marginBottom: 28 }}>
            <div style={{ fontSize: 13, color: T.mid, lineHeight: 1.5 }}>
              <strong style={{ color: T.text }}>Invite code:</strong>{" "}
              <span style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: T.terra, fontSize: 14 }}>{inviteCode}</span>
              <br />
              <span style={{ fontSize: 12, color: T.muted }}>They can also enter this code manually when signing up.</span>
            </div>
          </div>
        </>
      )}

      <button className="ob-btn" onClick={onNext} style={{ marginBottom: 12 }}>
        Continue →
      </button>
      <button className="ob-btn-ghost" onClick={onNext}>
        Skip for now — invite later from Settings
      </button>
    </div>
  );
}

// ── STEP 4: READY ─────────────────────────────────────────────────────────────
function StepReady({ displayName, onComplete }) {
  return (
    <div style={{ textAlign: "center" }}>
      <ProgressBar step={4} total={4} />

      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: T.oliveL, border: `2px solid ${T.olive}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 36, margin: "0 auto 28px",
        animation: "checkPop 0.5s ease both",
      }}>✓</div>

      <div className="ob-fade" style={{ fontSize: 11, letterSpacing: "0.25em", color: T.terra, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", marginBottom: 12 }}>
        You're all set
      </div>
      <h2 className="ob-fade-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 400, color: T.text, marginBottom: 16 }}>
        Ready for your<br /><em style={{ color: T.terra }}>first FamilyPause.</em>
      </h2>
      <p className="ob-fade-2" style={{ fontSize: 16, color: T.mid, lineHeight: 1.65, marginBottom: 40, maxWidth: 400, margin: "0 auto 40px" }}>
        Sit down together, hit Record or paste your transcript, and let the AI do the rest. Your week will be organized in minutes.
      </p>

      <div className="ob-fade-3" style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 340, margin: "0 auto" }}>
        {[
          ["🎙", "Record your conversation live"],
          ["📋", "Or paste a transcript from Otter"],
          ["✓", "Review cards together — Keep or Discard"],
          ["📅", "Send appointments to Google Calendar"],
        ].map(([icon, text]) => (
          <div key={text} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: T.surface, borderRadius: 10, textAlign: "left" }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: 14, color: T.mid }}>{text}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40 }} className="ob-fade-4">
        <button className="ob-btn" onClick={onComplete} style={{ maxWidth: 340, margin: "0 auto" }}>
          Start My First FamilyPause →
        </button>
      </div>
    </div>
  );
}

// ── MAIN ONBOARDING EXPORT ────────────────────────────────────────────────────
// Usage in App.jsx:
// <Onboarding
//   workspaceId={workspaceId}
//   displayName={displayName}
//   inviteCode={inviteCode}
//   onComplete={() => setAppPhase("app")}
// />

export default function Onboarding({ workspaceId, displayName, inviteCode, onComplete }) {
  const [step, setStep] = useState(1);
  const [familyData, setFamilyData] = useState({});

  return (
    <div style={{
      minHeight: "100vh",
      background: T.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      fontFamily: "'Lora', serif",
    }}>
      <style>{css}</style>
      <div style={{ width: "100%", maxWidth: 560 }}>

        {step === 1 && (
          <StepWelcome
            displayName={displayName}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <StepFamilySetup
            workspaceId={workspaceId}
            displayName={displayName}
            onNext={(data) => { setFamilyData(data); setStep(3); }}
          />
        )}

        {step === 3 && (
          <StepInvite
            workspaceId={workspaceId}
            spouseName={familyData.spouseName}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <StepReady
            displayName={displayName}
            onComplete={onComplete}
          />
        )}

      </div>
    </div>
  );
}
