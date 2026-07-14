/**
 * Parked from onboarding (Elon cut). Used as a post-Plan nudge in App.jsx.
 */
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import "../../styles/onboarding.css";

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

export default function InviteSpouseForm({
  workspaceId,
  spouseName,
  inviteCode: initialInviteCode,
  onDone,
  eyebrow = "Share the win",
  title,
  body = "You'll share the same sessions, plans, and history, updated in real time on both your phones.",
}) {
  const [inviteCode, setInviteCode] = useState(initialInviteCode || null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(!initialInviteCode);

  const resolvedTitle = title ?? (
    <>Share this week with {spouseName || "your spouse"}</>
  );

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
      ? `Hey ${spouseName}, look at this week's FamilyPause plan. Join so we can plan together: ${inviteLink}`
      : `Join my FamilyPause so we can plan our week together: ${inviteLink}`
  )}`;

  const dismiss = async () => {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("family_context")
      .eq("id", workspaceId)
      .single();
    const prev = ws?.family_context && typeof ws.family_context === "object" ? ws.family_context : {};
    const family_context = {
      ...prev,
      invite_nudge_dismissed_at: new Date().toISOString(),
    };
    const { data } = await supabase
      .from("workspaces")
      .update({ family_context })
      .eq("id", workspaceId)
      .select()
      .single();
    onDone?.(data || { family_context });
  };

  return (
    <div className="ob-page" style={{ minHeight: "auto", background: "transparent", padding: "24px 0" }}>
      <div className="ob-column" style={{ maxWidth: 480 }}>
        <div className="ob-anim" style={{ "--d": "0ms" }}><div className="ob-eyebrow">{eyebrow}</div></div>
        <h1 className="ob-anim ob-hl" style={{ "--d": "70ms" }}>{resolvedTitle}</h1>
        <p className="ob-anim ob-body" style={{ "--d": "140ms" }}>{body}</p>

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
            </div>
          </>
        )}

        <div className="ob-anim" style={{ "--d": "420ms" }}>
          <button type="button" className="ob-btn-primary" onClick={dismiss}>Done</button>
          <button type="button" className="ob-btn-ghost" onClick={dismiss}>Skip for now</button>
        </div>
      </div>
    </div>
  );
}
