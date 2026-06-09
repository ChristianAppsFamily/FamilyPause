// ─────────────────────────────────────────────────────────────────────────────
// Auth.jsx — FamilyPause
// Screens: Sign In, Sign Up, Forgot Password
// Drop into: src/components/Auth.jsx
// Requires: src/lib/supabase.js
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { supabase } from "../lib/supabase";

// ── TERRA & CREAM PALETTE ─────────────────────────────────────────────────────
// Palette mapped to the design bundle (src/styles/tokens.css) — source of truth.
const T = {
  bg:        "#FBF6EC",  // --paper
  surface:   "#FCF8F0",  // --paper-card
  border:    "#E6D9C4",  // --line
  text:      "#2A251D",  // --ink
  mid:       "#5B5245",  // --ink-2
  muted:     "#8C8070",  // --ink-3
  terra:     "#BE5A37",  // --terra
  terraL:    "#FAEAE0",  // --terra-tint
  terraD:    "#A2481F",  // --terra-d
  olive:     "#5E6B37",  // --olive
  oliveL:    "#EDF0E1",  // --olive-tint
  gold:      "#C09740",  // --gold
  red:       "#C0402F",  // --red
  redL:      "#FBEAE5",  // --red-tint
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%,60% { transform: translateX(-6px); }
    40%,80% { transform: translateX(6px); }
  }
  .fp-fade { animation: fadeUp 0.5s ease both; }
  .fp-fade-1 { animation: fadeUp 0.5s 0.05s ease both; }
  .fp-fade-2 { animation: fadeUp 0.5s 0.1s ease both; }
  .fp-fade-3 { animation: fadeUp 0.5s 0.15s ease both; }
  .fp-fade-4 { animation: fadeUp 0.5s 0.2s ease both; }
  .fp-fade-5 { animation: fadeUp 0.5s 0.25s ease both; }
  .fp-shake  { animation: shake 0.4s ease; }
  .fp-input {
    width: 100%;
    background: ${T.bg};
    border: 1px solid ${T.border};
    border-radius: 8px;
    color: ${T.text};
    padding: 13px 16px;
    font-size: 15px;
    font-family: 'Lora', serif;
    transition: border-color 0.2s, box-shadow 0.2s;
    outline: none;
  }
  .fp-input:focus {
    border-color: ${T.terra};
    box-shadow: 0 0 0 3px ${T.terraL};
  }
  .fp-input::placeholder { color: ${T.muted}; }
  .fp-input.error { border-color: ${T.red}; box-shadow: 0 0 0 3px ${T.redL}; }
  /* Auth prototype uses Lora sentence-case primary buttons (not the app's mono). */
  .fp-btn-primary {
    width: 100%;
    background: ${T.terra};
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 14px;
    font-size: 16px;
    font-family: 'Lora', serif; font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 16px rgba(190,90,55,0.25);
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .fp-btn-primary:hover:not(:disabled) {
    background: ${T.terraD};
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(190,90,55,0.32);
  }
  .fp-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .fp-btn-google {
    width: 100%;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    background: #ffffff;
    border: 1px solid ${T.border};
    border-radius: 8px;
    color: ${T.text};
    padding: 13px 16px;
    font-size: 15px;
    font-family: 'Lora', serif;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(46,40,32,0.07);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  .fp-btn-google:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(46,40,32,0.10); }
  .fp-btn-ghost {
    background: none;
    border: 1px solid ${T.border};
    border-radius: 8px;
    color: ${T.mid};
    padding: 12px;
    font-size: 14px;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.05em;
    cursor: pointer;
    width: 100%;
    transition: all 0.2s;
  }
  .fp-wordmark {
    font-family: 'Playfair Display', serif; font-style: italic;
    font-size: 18px; font-weight: 500; margin-bottom: 18px;
  }
  .fp-wordmark .wf { color: ${T.text}; }
  .fp-wordmark .wp { color: ${T.terra}; }
  .fp-btn-ghost:hover { border-color: ${T.terra}; color: ${T.terra}; }
  .fp-link {
    background: none; border: none; cursor: pointer;
    color: ${T.terra}; font-family: 'Lora', serif; font-size: 14px;
    text-decoration: underline; text-underline-offset: 2px;
    padding: 0; transition: color 0.15s;
  }
  .fp-link:hover { color: ${T.terraD}; }
  .fp-label {
    display: block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${T.mid};
    margin-bottom: 7px;
  }
  .fp-field { margin-bottom: 20px; }
  .fp-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 24px 0;
  }
  .fp-divider::before, .fp-divider::after {
    content: ''; flex: 1; height: 1px; background: ${T.border};
  }
  .fp-divider span {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; color: ${T.muted}; letter-spacing: 0.1em;
  }
`;

// ── SHARED LAYOUT WRAPPER ─────────────────────────────────────────────────────
function AuthShell({ children, wide = false }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: T.bg,
      display: "flex",
      fontFamily: "'Lora', serif",
    }}>
      <style>{css}</style>

      {/* Left decorative panel */}
      <div style={{
        width: 380,
        background: `linear-gradient(160deg, ${T.terra} 0%, ${T.terraD} 100%)`,
        padding: "60px 48px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
      }}
        className="fp-left-panel"
      >
        {/* Decorative watermark — the logo mark itself, faint, bottom-right */}
        <div style={{ position: "absolute", bottom: -28, right: -22, opacity: 0.06, pointerEvents: "none" }} aria-hidden="true">
          <LogoMark width={141} height={180} fill="#FAF7F2" />
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 36 }}>
            <LogoMark width={17} height={28} fill="#FAF7F2" />
            <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 22, fontWeight: 400, letterSpacing: "-0.01em" }}>
              <span style={{ color: "#FAF7F2" }}>Family</span><span style={{ color: "rgba(250,247,242,0.72)" }}>Pause</span>
            </div>
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 32, fontWeight: 400, color: T.bg, lineHeight: 1.25, marginBottom: 20 }}>
            The weekly reset every family needs
          </div>
          <div style={{ width: 40, height: 2, background: "rgba(250,247,242,0.3)", marginBottom: 24 }} />
          <p style={{ fontSize: 15, color: "rgba(250,247,242,0.7)", lineHeight: 1.65 }}>
            Record your family meeting. AI extracts every action and appointment. Review together in minutes.
          </p>
        </div>

        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontStyle: "italic", color: "rgba(250,247,242,0.85)", lineHeight: 1.5, marginBottom: 12 }}>
            "We did a FamilyPause this weekend and got back on track."
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(250,247,242,0.4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            — Spence, Founder
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 48px",
        overflowY: "auto",
      }}>
        <div style={{ width: "100%", maxWidth: wide ? 480 : 400 }}>
          {children}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .fp-left-panel { display: none; }
        }
      `}</style>
    </div>
  );
}

// ── ERROR BANNER ──────────────────────────────────────────────────────────────
function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div style={{
      background: T.redL,
      border: `1px solid ${T.red}44`,
      borderRadius: 8,
      padding: "12px 16px",
      marginBottom: 20,
      fontSize: 14,
      color: T.red,
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: "0.02em",
    }}>
      {message}
    </div>
  );
}

// ── SUCCESS BANNER ────────────────────────────────────────────────────────────
function SuccessBanner({ message }) {
  if (!message) return null;
  return (
    <div style={{
      background: T.oliveL,
      border: `1px solid ${T.olive}44`,
      borderRadius: 8,
      padding: "12px 16px",
      marginBottom: 20,
      fontSize: 14,
      color: T.olive,
      fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: "0.02em",
    }}>
      {message}
    </div>
  );
}

// ── SPINNER ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{
      width: 18, height: 18,
      border: `2px solid rgba(250,247,242,0.4)`,
      borderTopColor: T.bg,
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }} />
  );
}

// ── LOGO MARK (two heads + pill bodies — the "ii" / two-people mark) ──────────
function LogoMark({ width = 17, height = 28, fill = "#FAF7F2", style }) {
  return (
    <svg viewBox="0 0 22 28" width={width} height={height} fill={fill} aria-hidden="true" style={style}>
      <circle cx="5.5" cy="4.5" r="3.5" />
      <rect x="1" y="10" width="9" height="17" rx="4.5" />
      <circle cx="16.5" cy="4.5" r="3.5" />
      <rect x="12" y="10" width="9" height="17" rx="4.5" />
    </svg>
  );
}

// ── GOOGLE ICON ───────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}

// ── SIGN IN ───────────────────────────────────────────────────────────────────
function SignIn({ onSwitch, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message === "Invalid login credentials"
        ? "Email or password is incorrect. Try again."
        : err.message);
      setLoading(false);
    } else {
      onSuccess();
    }
  };

  const handleKey = (e) => { if (e.key === "Enter") handleSignIn(); };

  const handleGoogle = async () => {
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (err) setError(err.message);
  };

  return (
    <AuthShell>
      <div className="fp-fade" style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
          <LogoMark width={14} height={22} fill={T.terra} />
          <div className="fp-wordmark" style={{ marginBottom: 0 }}><span className="wf">Family</span><span className="wp">Pause</span></div>
        </div>
        <div style={{ fontSize: 11, letterSpacing: "0.25em", color: T.terra, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", marginBottom: 12 }}>
          Welcome back
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 400, color: T.text, marginBottom: 8 }}>
          Sign in
        </h1>
        <p style={{ fontSize: 15, color: T.mid, marginBottom: 28 }}>
          Continue your family's weekly rhythm.
        </p>
      </div>

      <ErrorBanner message={error} />

      <div className="fp-fade-1" style={{ marginBottom: 4 }}>
        <button className="fp-btn-google" onClick={handleGoogle}>
          <GoogleIcon /> Continue with Google
        </button>
      </div>

      <div className="fp-divider fp-fade-1"><span>OR</span></div>

      <div className="fp-fade-1 fp-field">
        <label className="fp-label">Email</label>
        <input className="fp-input" type="email" placeholder="you@example.com"
          value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKey} autoFocus />
      </div>

      <div className="fp-fade-2 fp-field">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
          <label className="fp-label" style={{ margin: 0 }}>Password</label>
          <button className="fp-link" onClick={() => onSwitch("forgot")} style={{ fontSize: 12 }}>Forgot password?</button>
        </div>
        <input className="fp-input" type="password" placeholder="••••••••"
          value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKey} />
      </div>

      <div className="fp-fade-3" style={{ marginBottom: 20 }}>
        <button className="fp-btn-primary" onClick={handleSignIn} disabled={loading}>
          {loading ? <Spinner /> : "Sign In"}
        </button>
      </div>

      <div className="fp-fade-5" style={{ textAlign: "center", marginTop: 24 }}>
        <span style={{ fontSize: 14, color: T.mid }}>Don't have an account? </span>
        <button className="fp-link" onClick={() => onSwitch("signup")}>Create one free</button>
      </div>

      <div style={{ textAlign: "center", marginTop: 16 }} className="fp-fade-5">
        <span style={{ fontSize: 13, color: T.muted }}>Joining via invite? </span>
        <button className="fp-link" onClick={() => onSwitch("join")} style={{ fontSize: 13 }}>Enter invite code</button>
      </div>
    </AuthShell>
  );
}

// ── SIGN UP ───────────────────────────────────────────────────────────────────
function SignUp({ onSwitch, onSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignUp = async () => {
    if (!name || !email || !password || !confirm) { setError("Please fill in all fields."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    setError("");

    // Create auth user
    const { data, error: authErr } = await supabase.auth.signUp({ email, password });
    if (authErr) { setError(authErr.message); setLoading(false); return; }

    const userId = data.user?.id;
    if (!userId) { setError("Something went wrong. Please try again."); setLoading(false); return; }

    // Create workspace
    const { data: ws, error: wsErr } = await supabase
      .from("workspaces")
      .insert({ name: `${name}'s Family`, owner_id: userId })
      .select()
      .single();

    if (wsErr) { setError(wsErr.message); setLoading(false); return; }

    // Add owner as member
    await supabase.from("workspace_members").insert({
      workspace_id: ws.id,
      user_id: userId,
      role: "owner",
      display_name: name,
    });

    onSuccess({ workspaceId: ws.id, inviteCode: ws.invite_code, displayName: name });
  };

  const handleKey = (e) => { if (e.key === "Enter") handleSignUp(); };

  const handleGoogle = async () => {
    setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (err) setError(err.message);
  };

  return (
    <AuthShell wide>
      <div className="fp-fade" style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
          <LogoMark width={14} height={22} fill={T.terra} />
          <div className="fp-wordmark" style={{ marginBottom: 0 }}><span className="wf">Family</span><span className="wp">Pause</span></div>
        </div>
        <div style={{ fontSize: 11, letterSpacing: "0.25em", color: T.terra, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", marginBottom: 12 }}>
          7-day free trial
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 400, color: T.text, marginBottom: 8 }}>
          Create your account
        </h1>
        <p style={{ fontSize: 15, color: T.mid, marginBottom: 28 }}>
          No credit card required. Cancel anytime.
        </p>
      </div>

      <ErrorBanner message={error} />

      <div className="fp-fade-1" style={{ marginBottom: 4 }}>
        <button className="fp-btn-google" onClick={handleGoogle}>
          <GoogleIcon /> Continue with Google
        </button>
      </div>
      <div className="fp-divider fp-fade-1"><span>OR</span></div>

      <div className="fp-fade-1 fp-field">
        <label className="fp-label">Your first name</label>
        <input className="fp-input" type="text" placeholder="Spence"
          value={name} onChange={e => setName(e.target.value)} onKeyDown={handleKey} autoFocus />
      </div>

      <div className="fp-fade-2 fp-field">
        <label className="fp-label">Email</label>
        <input className="fp-input" type="email" placeholder="you@example.com"
          value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKey} />
      </div>

      <div className="fp-fade-3 fp-field">
        <label className="fp-label">Password</label>
        <input className="fp-input" type="password" placeholder="Min. 8 characters"
          value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKey} />
      </div>

      <div className="fp-fade-4 fp-field">
        <label className="fp-label">Confirm password</label>
        <input className="fp-input" type="password" placeholder="••••••••"
          value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={handleKey} />
      </div>

      <div className="fp-fade-5" style={{ marginBottom: 16 }}>
        <button className="fp-btn-primary" onClick={handleSignUp} disabled={loading}>
          {loading ? <Spinner /> : "Create Account & Start Free Trial"}
        </button>
      </div>

      <p style={{ fontSize: 12, color: T.muted, fontFamily: "'JetBrains Mono', monospace", textAlign: "center", marginBottom: 24, lineHeight: 1.5 }} className="fp-fade-5">
        By signing up you agree to our Terms of Service.<br />Ad-free forever. Your conversations are private.
      </p>

      <div className="fp-divider fp-fade-5"><span>OR</span></div>

      <div style={{ textAlign: "center" }} className="fp-fade-5">
        <span style={{ fontSize: 14, color: T.mid }}>Already have an account? </span>
        <button className="fp-link" onClick={() => onSwitch("signin")}>Sign in</button>
      </div>
    </AuthShell>
  );
}

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
function ForgotPassword({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email) { setError("Please enter your email."); return; }
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) { setError(err.message); setLoading(false); }
    else { setSent(true); setLoading(false); }
  };

  return (
    <AuthShell>
      <div className="fp-fade">
        <div style={{ fontSize: 11, letterSpacing: "0.25em", color: T.terra, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", marginBottom: 12 }}>
          Reset password
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 400, color: T.text, marginBottom: 8 }}>
          Forgot your<br />password?
        </h1>
        <p style={{ fontSize: 15, color: T.mid, marginBottom: 36 }}>
          No problem. Enter your email and we'll send a reset link.
        </p>
      </div>

      {!sent ? (
        <>
          <ErrorBanner message={error} />

          <div className="fp-fade-1 fp-field">
            <label className="fp-label">Email</label>
            <input className="fp-input" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleReset()} autoFocus />
          </div>

          <div className="fp-fade-2" style={{ marginBottom: 20 }}>
            <button className="fp-btn-primary" onClick={handleReset} disabled={loading}>
              {loading ? <Spinner /> : "Send Reset Link"}
            </button>
          </div>
        </>
      ) : (
        <SuccessBanner message={`Reset link sent to ${email}. Check your inbox — it may take a minute.`} />
      )}

      <div className="fp-fade-3" style={{ textAlign: "center", marginTop: 8 }}>
        <button className="fp-link" onClick={() => onSwitch("signin")}>← Back to sign in</button>
      </div>
    </AuthShell>
  );
}

// ── JOIN VIA INVITE CODE ──────────────────────────────────────────────────────
function JoinWorkspace({ onSwitch, onSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill invite code from URL if present
  // e.g. familypause.com/join/xK9m2p
  useState(() => {
    const path = window.location.pathname;
    const match = path.match(/\/join\/([a-zA-Z0-9-]+)/);
    if (match) setInviteCode(match[1]);
  });

  const handleJoin = async () => {
    if (!name || !email || !password || !inviteCode) { setError("Please fill in all fields."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    setError("");

    // Create auth user
    const { data, error: authErr } = await supabase.auth.signUp({ email, password });
    if (authErr) { setError(authErr.message); setLoading(false); return; }

    const userId = data.user?.id;
    if (!userId) { setError("Something went wrong. Please try again."); setLoading(false); return; }

    // Join workspace via invite code
    const { data: wsId, error: joinErr } = await supabase.rpc("join_workspace_by_code", {
      invite: inviteCode.trim().toLowerCase(),
      display: name,
    });

    if (joinErr) {
      setError("Invalid invite code. Ask the person who invited you for the correct link.");
      setLoading(false);
      return;
    }

    onSuccess({ workspaceId: wsId, displayName: name, joined: true });
  };

  return (
    <AuthShell wide>
      <div className="fp-fade">
        <div style={{ fontSize: 11, letterSpacing: "0.25em", color: T.terra, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", marginBottom: 12 }}>
          You're invited
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 400, color: T.text, marginBottom: 8 }}>
          Join your<br />family workspace
        </h1>
        <p style={{ fontSize: 15, color: T.mid, marginBottom: 36 }}>
          Create your account to join. You'll share the same sessions, plans, and history.
        </p>
      </div>

      <ErrorBanner message={error} />

      <div className="fp-fade-1 fp-field">
        <label className="fp-label">Your first name</label>
        <input className="fp-input" type="text" placeholder="Amanda"
          value={name} onChange={e => setName(e.target.value)} autoFocus />
      </div>

      <div className="fp-fade-2 fp-field">
        <label className="fp-label">Email</label>
        <input className="fp-input" type="email" placeholder="you@example.com"
          value={email} onChange={e => setEmail(e.target.value)} />
      </div>

      <div className="fp-fade-3 fp-field">
        <label className="fp-label">Create a password</label>
        <input className="fp-input" type="password" placeholder="Min. 8 characters"
          value={password} onChange={e => setPassword(e.target.value)} />
      </div>

      <div className="fp-fade-4 fp-field">
        <label className="fp-label">Invite code</label>
        <input className="fp-input" type="text" placeholder="e.g. xK9m2p"
          value={inviteCode} onChange={e => setInviteCode(e.target.value)}
          style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }} />
        <div style={{ fontSize: 11, color: T.muted, fontFamily: "'JetBrains Mono', monospace", marginTop: 6 }}>
          Find this in the invite link your spouse sent you.
        </div>
      </div>

      <div className="fp-fade-5" style={{ marginBottom: 20 }}>
        <button className="fp-btn-primary" onClick={handleJoin} disabled={loading}>
          {loading ? <Spinner /> : "Join Family Workspace"}
        </button>
      </div>

      <div style={{ textAlign: "center" }} className="fp-fade-5">
        <span style={{ fontSize: 14, color: T.mid }}>Already have an account? </span>
        <button className="fp-link" onClick={() => onSwitch("signin")}>Sign in</button>
      </div>
    </AuthShell>
  );
}

// ── MAIN AUTH EXPORT ──────────────────────────────────────────────────────────
// Usage in App.jsx:
// <Auth onAuthenticated={(user, workspace) => setAppState({ user, workspace })} />

export default function Auth({ onAuthenticated }) {
  const [screen, setScreen] = useState("signin");

  const handleSignInSuccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, display_name, workspaces(*)")
      .eq("user_id", user.id)
      .single();
    onAuthenticated(user, membership?.workspaces || null);
  };

  const handleSignUpSuccess = ({ workspaceId, inviteCode, displayName }) => {
    // Pass workspace info up so Onboarding can show the invite link
    onAuthenticated({ newUser: true, inviteCode, displayName, workspaceId });
  };

  const handleJoinSuccess = ({ workspaceId, displayName }) => {
    onAuthenticated({ newUser: true, joined: true, displayName, workspaceId });
  };

  if (screen === "signin")  return <SignIn  onSwitch={setScreen} onSuccess={handleSignInSuccess} />;
  if (screen === "signup")  return <SignUp  onSwitch={setScreen} onSuccess={handleSignUpSuccess} />;
  if (screen === "forgot")  return <ForgotPassword onSwitch={setScreen} />;
  if (screen === "join")    return <JoinWorkspace  onSwitch={setScreen} onSuccess={handleJoinSuccess} />;
  return null;
}
