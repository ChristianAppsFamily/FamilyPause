import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Seo from "./Seo.jsx";

const css = `
.fp-sub {
  min-height: 100vh;
  background:
    radial-gradient(700px 380px at 50% 0%, var(--terra-tint), transparent 65%),
    #FAF7F2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  font-family: var(--serif);
  color: var(--ink);
}
.fp-sub-card {
  width: 100%;
  max-width: 440px;
  text-align: center;
}
.fp-sub-mark {
  width: 44px;
  height: 44px;
  border-radius: 11px;
  margin: 0 auto 22px;
  display: block;
}
.fp-sub-title {
  margin: 0 0 14px;
  font-family: var(--display);
  font-size: 28px;
  font-style: italic;
  font-weight: 600;
  line-height: 1.2;
  color: #2E2820;
}
.fp-sub-title.is-soft {
  font-size: 24px;
}
.fp-sub-body {
  margin: 0 0 28px;
  font-family: var(--serif);
  font-size: 16px;
  line-height: 1.6;
  color: #6A5A40;
}
.fp-sub-body.is-mid {
  font-size: 14px;
}
.fp-sub-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 14px 28px;
  border: none;
  border-radius: 8px;
  background: var(--terra);
  color: #fff;
  font-family: var(--serif);
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(190, 90, 55, .24);
  transition: background .15s, transform .12s;
}
.fp-sub-btn:hover { background: var(--terra-d); transform: translateY(-1px); }
.fp-sub-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 12px 22px;
  border: 1px solid var(--line-2);
  border-radius: 8px;
  background: transparent;
  color: var(--ink-2);
  font-family: var(--serif);
  font-size: 15px;
  cursor: pointer;
  transition: color .15s, border-color .15s;
}
.fp-sub-ghost:hover {
  color: var(--terra);
  border-color: var(--terra);
}
.fp-sub-note {
  margin: 18px 0 0;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .04em;
  color: var(--ink-3);
}
`;

/** Refresh the signed-in user's workspace subscription row from Supabase. */
async function refreshSubscriptionStatus() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "signed_out" };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership?.workspace_id) return { ok: false, reason: "no_workspace" };

  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("workspace_id", membership.workspace_id)
    .maybeSingle();

  if (error) return { ok: false, reason: "query_failed", error };
  return { ok: true, subscription, workspaceId: membership.workspace_id };
}

export function SubscribeSuccess() {
  const navigate = useNavigate();
  const [statusNote, setStatusNote] = useState("Confirming your plan…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await refreshSubscriptionStatus();
      if (cancelled) return;
      if (result.ok && result.subscription?.plan && result.subscription.plan !== "free") {
        setStatusNote("Subscription active.");
      } else if (result.ok) {
        setStatusNote("Plan update may take a moment. You can continue to your app.");
      } else if (result.reason === "signed_out") {
        setStatusNote("Sign in to see your plan in the app.");
      } else {
        setStatusNote("You can continue to your app anytime.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="fp-sub">
      <Seo
        title="You're all set — FamilyPause"
        description="Your Family Plan is now active. Welcome to FamilyPause."
        canonical="https://familypause.com/subscribe/success"
      />
      <style>{css}</style>
      <div className="fp-sub-card">
        <img className="fp-sub-mark" src="/uploads/Logo_4.png" alt="" />
        <h1 className="fp-sub-title">You&apos;re all set.</h1>
        <p className="fp-sub-body">Your Family Plan is now active. Welcome to FamilyPause.</p>
        <button
          type="button"
          className="fp-sub-btn"
          onClick={() => navigate("/app", { replace: true })}
        >
          Go to My Plan
        </button>
        <p className="fp-sub-note">{statusNote}</p>
      </div>
    </div>
  );
}

export function SubscribeCancel() {
  const navigate = useNavigate();

  return (
    <div className="fp-sub">
      <Seo
        title="No worries — FamilyPause"
        description="You can upgrade anytime from your account settings."
        canonical="https://familypause.com/subscribe/cancel"
      />
      <style>{css}</style>
      <div className="fp-sub-card">
        <img className="fp-sub-mark" src="/uploads/Logo_4.png" alt="" />
        <h1 className="fp-sub-title is-soft">No worries.</h1>
        <p className="fp-sub-body is-mid">You can upgrade anytime from your account settings.</p>
        <button
          type="button"
          className="fp-sub-ghost"
          onClick={() => navigate("/app", { replace: true })}
        >
          Back to FamilyPause
        </button>
      </div>
    </div>
  );
}
