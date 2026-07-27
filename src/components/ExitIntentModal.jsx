// Exit-intent founding member offer on the marketing landing page.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { isExistingAccountSignup } from "../lib/authSignup";
import { ensureTrialSubscription } from "../lib/subscription";
import { triggerWelcomeEmail } from "../lib/welcomeEmail";

const EXIT_FLAG = "exit_intent_shown";
const FOUNDING_CAP = 100;

function parseConfigCount(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  }
  if (value != null && typeof value === "object" && "count" in value) {
    return parseConfigCount(value.count);
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function generateTempPassword() {
  const rand = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, "")
    : `${Date.now()}${Math.random().toString(36).slice(2)}`;
  return `Fp!${rand.slice(0, 20)}9aA`;
}

function markExitShown() {
  try {
    sessionStorage.setItem(EXIT_FLAG, "1");
  } catch {
    /* ignore */
  }
}

function hasExitShown() {
  try {
    return sessionStorage.getItem(EXIT_FLAG) === "1";
  } catch {
    return false;
  }
}

/**
 * @param {{ onStarted?: () => void }} props
 */
export default function ExitIntentModal({ onStarted = () => {} }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success
  const [error, setError] = useState("");
  const [spotsRemaining, setSpotsRemaining] = useState(null);
  const [signedIn, setSignedIn] = useState(null); // null = loading
  const shownThisPage = useRef(false);

  // Auth gate
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(!!data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
      if (session) setOpen(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Spots remaining from app_config.subscriber_count
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "subscriber_count")
        .maybeSingle();
      if (!active) return;
      const count = parseConfigCount(data?.value);
      setSpotsRemaining(Math.max(0, FOUNDING_CAP - count));
    })();
    return () => { active = false; };
  }, []);

  // Triggers: desktop mouse-exit + mobile scroll-back
  useEffect(() => {
    if (signedIn) return undefined;
    if (signedIn === null) return undefined; // wait for auth check
    if (hasExitShown()) return undefined;
    if (spotsRemaining === null) return undefined;
    if (spotsRemaining <= 0) return undefined;

    const tryShow = () => {
      if (shownThisPage.current || hasExitShown() || signedIn) return;
      shownThisPage.current = true;
      setOpen(true);
    };

    const onMouseOut = (event) => {
      if (event.clientY > 0) return;
      if (event.relatedTarget || event.toElement) return;
      tryShow();
    };

    let maxScroll = 0;
    const onScroll = () => {
      const y = window.scrollY || 0;
      if (y > maxScroll) maxScroll = y;
      // Mobile scroll-back: deep scroll then reverse upward
      if (maxScroll > 380 && y < maxScroll - 140) {
        tryShow();
      }
    };

    document.addEventListener("mouseout", onMouseOut);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("scroll", onScroll);
    };
  }, [signedIn, spotsRemaining]);

  const close = () => {
    markExitShown();
    setOpen(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setStatus("loading");

    // Best-effort lead capture — signup continues even if this fails.
    try {
      await supabase.functions.invoke("capture-lead", {
        body: { email: trimmed, kind: "founding-member" },
      });
    } catch {
      /* ignore */
    }

    const tempPassword = generateTempPassword();
    const { data: signUpData, error: authErr } = await supabase.auth.signUp({
      email: trimmed,
      password: tempPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { founding_member: true, founding_member_modal: true },
      },
    });

    if (authErr) {
      setStatus("idle");
      setError(authErr.message || "Could not create your account. Please try again.");
      return;
    }

    if (isExistingAccountSignup(signUpData)) {
      await supabase.auth.signOut();
      setStatus("idle");
      setError("An account with that email already exists. Sign in to continue.");
      return;
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      setStatus("idle");
      setError("Something went wrong. Please try again.");
      return;
    }

    const displayName = trimmed.split("@")[0] || "Member";
    const { data: ws, error: wsErr } = await supabase.rpc("create_owner_workspace", {
      p_name: displayName,
    });
    if (wsErr) {
      setStatus("idle");
      setError(wsErr.message || "Account created, but workspace setup failed. Sign in to finish.");
      return;
    }

    const workspace = Array.isArray(ws) ? ws[0] : ws;
    if (workspace?.id) {
      const prevMeta = workspace.metadata && typeof workspace.metadata === "object"
        ? workspace.metadata
        : {};
      await supabase
        .from("workspaces")
        .update({
          metadata: {
            ...prevMeta,
            founding_member: true,
            founding_member_modal: true,
          },
        })
        .eq("id", workspace.id);
      await ensureTrialSubscription(workspace.id);
    }

    // Password setup / magic recovery email
    await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    triggerWelcomeEmail({ email: trimmed, firstName: displayName, enrollDrip: true });

    markExitShown();
    setStatus("success");
    setTimeout(() => {
      setOpen(false);
      onStarted();
    }, 900);
  };

  if (!open || signedIn || (spotsRemaining !== null && spotsRemaining <= 0)) {
    return null;
  }

  const spotsColor = spotsRemaining != null && spotsRemaining < 20
    ? "var(--terra)"
    : "#4A6741";

  return (
    <div className="fp-exit-backdrop" onMouseDown={close} role="presentation">
      <div
        className="fp-exit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-intent-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="fp-exit-x" onClick={close} aria-label="Close">
          ×
        </button>

        {status === "success" ? (
          <div className="fp-exit-success">
            <div className="fp-exit-check" aria-hidden="true">✓</div>
            <h2 id="exit-intent-title">You're in. Check your email.</h2>
            <p>We started your free trial and sent a link to set your password.</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="fp-exit-pill">Founding Member Offer</div>
            <h2 className="fp-exit-hl" id="exit-intent-title">Before you go.</h2>
            <p className="fp-exit-sub">
              Try FamilyPause free for 7 days. No credit card required.
            </p>

            <hr className="fp-exit-rule" />

            <ul className="fp-exit-offers">
              <li>
                <span className="fp-exit-ico fp-exit-ico--olive" aria-hidden="true">✓</span>
                <span>First 100 founding members receive the digital card deck free, forever.</span>
              </li>
              <li>
                <span className="fp-exit-ico fp-exit-ico--gold" aria-hidden="true">✓</span>
                <span>Sign up as a member today and receive 30% off your first month.</span>
              </li>
            </ul>

            {spotsRemaining != null && (
              <p className="fp-exit-spots" style={{ color: spotsColor }}>
                {spotsRemaining} founding member spots remaining.
              </p>
            )}

            <input
              className="fp-guide-input"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              disabled={status === "loading"}
              aria-invalid={!!error}
              required
            />
            {error && (
              <p className="fp-guide-error" role="alert">{error}</p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-block fp-guide-submit"
              disabled={status === "loading" || !email.trim()}
            >
              {status === "loading" ? "Starting…" : "Start My Free 7 Days"}
            </button>

            <p className="fp-exit-fine">No credit card required. Cancel anytime.</p>

            <button type="button" className="fp-exit-pass" onClick={close}>
              No thanks, I&apos;ll pass.
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
