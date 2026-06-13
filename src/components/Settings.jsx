// ─────────────────────────────────────────────────────────────────────────────
// Settings.jsx - FamilyPause
// Visual source of truth: project/app/styles.css + screens.css (design bundle).
// Composes the shared design classes from src/styles/tokens.css.
// Sections: Family members, Invite code, Card decks, Subscription,
//           Sign out, Danger zone (delete workspace)
//
// Props:
//   workspace   { id, name, invite_code, family_context, unlocked_deck_years, cards_unlocked }
//   user        supabase auth user
//   onSignOut() called to sign the user out (passed from AppRouter)
//   onClose()   optional: return to the main app
//   onOpenDecks() optional: open the CardSystem unlock flow
//   onOpenHistory() optional: open SessionHistory overlay
//   onWorkspaceUpdate(updatedWorkspace) optional: bubble saved workspace up
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const css = `
  .set-sec { padding: 24px 26px; margin-bottom: 18px; }
  .set-sec .eyebrow { margin-bottom: 9px; }
  .set-sec > h2 { font-size: 23px; margin-bottom: 18px; }
  .set-sub { color: var(--ink-2); font-size: 15px; line-height: 1.55; margin: 0 0 16px; }
  .set-grouplbl {
    font-family: var(--mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--ink-3); margin-bottom: 10px;
  }
  .set-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 11px; }
  .set-chip {
    display: inline-flex; align-items: center; gap: 9px;
    background: var(--paper-2); border: 1px solid var(--line);
    border-radius: 999px; padding: 6px 7px 6px 14px;
    font-family: var(--serif); font-size: 14.5px; color: var(--ink);
  }
  .set-chip.spence { background: var(--terra-soft); border-color: var(--terra-soft); color: var(--terra-d); }
  .set-chip.amanda { background: var(--olive-soft); border-color: var(--olive-soft); color: var(--olive-d); }
  .set-chip.both   { background: var(--gold-soft);  border-color: var(--gold-soft);  color: #8a6a16; }
  .set-chip .x {
    width: 19px; height: 19px; border-radius: 50%; border: none; cursor: pointer;
    display: grid; place-items: center; font-size: 13px; line-height: 1;
    background: rgba(42,37,29,.10); color: inherit; transition: background .15s;
  }
  .set-chip .x:hover { background: rgba(42,37,29,.20); }
  .set-empty { color: var(--ink-3); font-style: italic; font-size: 14.5px; margin-bottom: 11px; }
  .set-addrow { display: flex; gap: 9px; align-items: stretch; }
  .set-addrow .field { flex: 1; }
  .set-saved { font-family: var(--mono); font-size: 11.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--olive-d); }
  .set-codebox {
    flex: 1; background: var(--paper); border: 1px solid var(--line); border-radius: var(--r);
    padding: 14px 16px; font-family: var(--mono); font-size: 16px; letter-spacing: .12em;
    color: var(--ink); user-select: all; overflow-x: auto; white-space: nowrap;
  }
  .set-deckpill {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--gold-soft); color: #8a6a16; border-radius: 999px;
    padding: 7px 14px; font-family: var(--mono); font-size: 11.5px; letter-spacing: .06em; text-transform: uppercase;
  }
  .set-plan { display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; }
  .set-plan .name { font-family: var(--display); font-size: 26px; color: var(--ink); }
  .set-spin {
    width: 24px; height: 24px; border: 2px solid var(--line);
    border-top-color: var(--terra); border-radius: 50%; animation: fpspin .8s linear infinite;
  }
  .set-danger { background: var(--red-tint); border-color: var(--red-soft); }
  .set-danger .eyebrow, .set-danger > h2 { color: var(--red); }
  @media (max-width: 600px) {
    .set-sec { padding: 18px 16px; }
    .set-sec > h2 { font-size: 20px; }
    .set-plan .name { font-size: 22px; }
    .set-addrow { flex-direction: column; }
    .set-addrow .btn { width: 100%; justify-content: center; }
  }
`;

// ── EDITABLE NAME LIST ────────────────────────────────────────────────────────
function NameList({ label, items, tone, onAdd, onRemove, placeholder, emptyNote }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onAdd(v);
    setDraft("");
  };
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="set-grouplbl">{label}</div>
      {items.length > 0 ? (
        <div className="set-chips">
          {items.map((it) => (
            <span key={it} className={`set-chip${tone ? " " + tone : ""}`}>
              {it}
              <button className="x" onClick={() => onRemove(it)} aria-label={`Remove ${it}`}>×</button>
            </span>
          ))}
        </div>
      ) : (
        <div className="set-empty">{emptyNote}</div>
      )}
      <div className="set-addrow">
        <input
          className="field"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button className="btn btn-soft" onClick={add}>Add</button>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Settings({ workspace, user, onSignOut, onClose, onOpenDecks, onOpenHistory, onWorkspaceUpdate }) {
  const fc = workspace?.family_context || {};
  const initialKids = Array.isArray(fc.kids) ? fc.kids : [];
  // "people" stores adults + kids together; derive adults by removing kids.
  const initialAdults = (Array.isArray(fc.people) ? fc.people : []).filter((p) => !initialKids.includes(p));

  const [adults, setAdults] = useState(initialAdults);
  const [kids, setKids] = useState(initialKids);
  const [businesses, setBusinesses] = useState(Array.isArray(fc.businesses) ? fc.businesses : []);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [subscription, setSubscription] = useState(null);
  const [subLoading, setSubLoading] = useState(true);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Members who accepted invite ────────────────────────────────────────────
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!workspace?.id) { setMembersLoading(false); return; }
      const { data } = await supabase
        .from("workspace_members")
        .select("user_id, role, display_name, joined_at")
        .eq("workspace_id", workspace.id)
        .order("joined_at", { ascending: true });
      if (active) setMembers(data || []);
      if (active) setMembersLoading(false);
    };
    load();
    return () => { active = false; };
  }, [workspace?.id]);

  // ── Change password ────────────────────────────────────────────────────────
  const [pwSending, setPwSending] = useState(false);
  const [pwSent, setPwSent] = useState(false);

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setPwSending(true);
    await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/app`,
    });
    setPwSending(false);
    setPwSent(true);
    setTimeout(() => setPwSent(false), 5000);
  };

  // ── Load subscription ──────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!workspace?.id) { setSubLoading(false); return; }
      try {
        const { data } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("workspace_id", workspace.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (active) setSubscription(data || null);
      } catch { /* offline / no subscription row: fall back to free plan */ }
      finally { if (active) setSubLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [workspace?.id]);

  // ── Save family members ────────────────────────────────────────────────────
  const saveFamily = async () => {
    if (!workspace?.id) { setError("No workspace loaded."); return; }
    setSaving(true); setSaved(false); setError("");
    const context = { ...fc, people: [...adults, ...kids], kids, businesses };
    const { data, error: err } = await supabase
      .from("workspaces")
      .update({ family_context: context })
      .eq("id", workspace.id)
      .select()
      .single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
    if (data && onWorkspaceUpdate) onWorkspaceUpdate(data);
  };

  // ── Copy invite code ───────────────────────────────────────────────────────
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(workspace?.invite_code || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: ignore */ }
  };

  // ── Plan + trial ───────────────────────────────────────────────────────────
  const planLabel = (() => {
    const p = subscription?.plan || "free";
    return { free: "Free", family: "Family Plan", pro: "Family Pro", ministry: "Church / Ministry" }[p] || p;
  })();

  const trialDaysRemaining = (() => {
    if (!subscription?.trial_ends_at) return null;
    const ms = new Date(subscription.trial_ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  })();

  const unlockedDecks = Array.isArray(workspace?.unlocked_deck_years) ? workspace.unlocked_deck_years : [];

  // ── Delete workspace ───────────────────────────────────────────────────────
  const deleteWorkspace = async () => {
    if (!workspace?.id) { setError("No workspace loaded."); return; }
    setDeleting(true); setError("");
    const { error: err } = await supabase.from("workspaces").delete().eq("id", workspace.id);
    if (err) { setDeleting(false); setError(err.message); return; }
    if (onSignOut) onSignOut();
  };

  return (
    <div className="stage view">
      <style>{css}</style>

      {/* Brand bar: matches design bundle (Family terra, Pause ink) */}
      <div className="brandbar">
        <div className="brand">
          <div className="mark">
            <img src="/uploads/Logo_4.png" alt="FamilyPause"
                 style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" }} />
          </div>
          <div className="word"><b>Family</b><span>Pause</span></div>
        </div>
        {onClose && <button className="btn btn-ghost" onClick={onClose}>Done</button>}
      </div>

      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Settings</div>
        <h1 style={{ fontSize: 40, lineHeight: 1.02, marginBottom: 6 }}>{workspace?.name || "Your family"}</h1>
        <p className="set-sub" style={{ marginBottom: 26 }}>Manage your family, plan, and workspace.</p>

        {error && (
          <div className="panel set-danger set-sec" style={{ padding: "14px 18px", marginBottom: 18 }}>
            <span style={{ fontFamily: "var(--serif)", color: "var(--red)", fontSize: 14.5 }}>{error}</span>
          </div>
        )}

        {/* ── FAMILY MEMBERS ─────────────────────────────────────────── */}
        <section className="panel set-sec rise">
          <div className="eyebrow">Who's in this family</div>
          <h2>Family members</h2>
          <NameList
            label="Parents" tone="" items={adults}
            placeholder="Add a parent's name" emptyNote="No parents added yet."
            onAdd={(v) => setAdults([...adults, v])}
            onRemove={(v) => setAdults(adults.filter((x) => x !== v))}
          />
          <NameList
            label="Kids" items={kids}
            placeholder="Add a child's name" emptyNote="No kids added yet."
            onAdd={(v) => setKids([...kids, v])}
            onRemove={(v) => setKids(kids.filter((x) => x !== v))}
          />
          <NameList
            label="Businesses" items={businesses}
            placeholder="Add a business name" emptyNote="No businesses added yet."
            onAdd={(v) => setBusinesses([...businesses, v])}
            onRemove={(v) => setBusinesses(businesses.filter((x) => x !== v))}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
            <button className="btn btn-primary" onClick={saveFamily} disabled={saving}>
              {saving ? "Saving…" : "Save family"}
            </button>
            {saved && <span className="set-saved">✓ Saved</span>}
          </div>
        </section>

        {/* ── INVITE CODE ────────────────────────────────────────────── */}
        <section className="panel set-sec rise">
          <div className="eyebrow">Bring in your spouse</div>
          <h2>Invite code</h2>
          <p className="set-sub">Share this code so your spouse can join the same family workspace.</p>
          <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
            <div className="set-codebox">{workspace?.invite_code || "Not set"}</div>
            <button className="btn btn-soft" onClick={copyInvite}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>

          {/* Members who have joined */}
          <div className="set-grouplbl" style={{ marginBottom: 10 }}>Members who joined</div>
          {membersLoading ? (
            <div className="set-spin" style={{ width: 18, height: 18 }} />
          ) : members.length === 0 ? (
            <p className="set-empty">No one has joined yet. Send your invite code above.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {members.map((m) => (
                <div key={m.user_id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "var(--paper-2)", borderRadius: "var(--r)", padding: "10px 14px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: m.role === "owner" ? "var(--terra-soft)" : "var(--olive-soft)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--display)", fontWeight: 600, fontSize: 14,
                      color: m.role === "owner" ? "var(--terra-d)" : "var(--olive-d)",
                    }}>
                      {(m.display_name || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--serif)", fontSize: 15, color: "var(--ink)" }}>
                        {m.display_name || "Unknown"}
                      </div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--ink-3)" }}>
                        {m.role === "owner" ? "Owner" : "Member"}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>
                    {m.joined_at ? new Date(m.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── SESSION HISTORY ────────────────────────────────────────── */}
        <section className="panel set-sec rise">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 9 }}>Past syncs</div>
              <h2 style={{ margin: 0 }}>Session history</h2>
            </div>
            {onOpenHistory && (
              <button className="btn btn-ghost" onClick={onOpenHistory} style={{ flexShrink: 0, marginTop: 4 }}>
                View history
              </button>
            )}
          </div>
          <p className="set-sub" style={{ margin: 0 }}>
            Every completed FamilyPause sync is saved here — dates, kept items, and the full card list.
          </p>
        </section>

        {/* ── CARD DECKS ─────────────────────────────────────────────── */}
        <section className="panel set-sec rise">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 9 }}>Conversation cards</div>
              <h2 style={{ margin: 0 }}>Card decks</h2>
            </div>
            {onOpenDecks && (
              <button className="btn btn-primary" onClick={onOpenDecks} style={{ flexShrink: 0, marginTop: 4 }}>
                {unlockedDecks.length > 0 ? "Open library" : "Unlock now"}
              </button>
            )}
          </div>
          {unlockedDecks.length > 0 ? (
            <div className="set-chips" style={{ marginBottom: 4 }}>
              {unlockedDecks.map((yr) => <span key={yr} className="set-deckpill">{yr} Deck</span>)}
            </div>
          ) : (
            <p className="set-sub" style={{ margin: 0 }}>
              You haven't unlocked any card decks yet. Unlock the 52-question deck to draw a
              conversation card together each week.
            </p>
          )}
        </section>

        {/* ── SUBSCRIPTION ───────────────────────────────────────────── */}
        <section className="panel set-sec rise">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 9 }}>Your plan</div>
              <h2 style={{ margin: 0 }}>Subscription</h2>
            </div>
            <a
              className="btn btn-primary"
              href="https://buy.stripe.com/PLACEHOLDER_pro"
              target="_blank"
              rel="noreferrer"
              style={{ flexShrink: 0, marginTop: 4, textDecoration: "none" }}
            >
              Upgrade to Pro
            </a>
          </div>
          {subLoading ? (
            <div className="set-spin" />
          ) : (
            <div>
              <div className="set-plan">
                <span className="name">{planLabel}</span>
                {subscription?.active && <span className="tag tag-amanda">Active</span>}
              </div>
              {(subscription?.plan === "free" || !subscription) && trialDaysRemaining !== null && (
                <p className="set-sub" style={{ margin: 0 }}>
                  {trialDaysRemaining > 0
                    ? `${trialDaysRemaining} day${trialDaysRemaining === 1 ? "" : "s"} left in your free trial.`
                    : "Your free trial has ended. Upgrade for unlimited AI sessions."}
                </p>
              )}
              {!subscription && trialDaysRemaining === null && (
                <p className="set-sub" style={{ margin: 0 }}>You're on the free plan, with 1 AI session per month.</p>
              )}
            </div>
          )}
        </section>

        {/* ── SIGN OUT ───────────────────────────────────────────────── */}
        <section className="panel set-sec rise">
          <div className="eyebrow">Account</div>
          <h2>Sign out</h2>
          <p className="set-sub">
            {user?.email ? `Signed in as ${user.email}.` : "Sign out of FamilyPause on this device."}
          </p>
          <button className="btn btn-ghost" onClick={onSignOut}>Sign out</button>
        </section>

        {/* ── DANGER ZONE ────────────────────────────────────────────── */}
        <section className="panel set-sec set-danger rise">
          <div className="eyebrow">Danger zone</div>
          <h2>Account actions</h2>

          {/* Change password */}
          <div style={{ borderBottom: "1px solid var(--red-soft)", paddingBottom: 22, marginBottom: 22 }}>
            <p className="set-sub" style={{ color: "var(--ink)", marginBottom: 12 }}>
              Change password — we'll send a reset link to {user?.email || "your email"}.
            </p>
            {pwSent ? (
              <p style={{ fontFamily: "var(--mono)", fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--olive-d)" }}>
                ✓ Reset link sent — check your inbox
              </p>
            ) : (
              <button className="btn btn-ghost" onClick={sendPasswordReset} disabled={pwSending}>
                {pwSending ? "Sending…" : "Send password reset"}
              </button>
            )}
          </div>

          {/* Delete workspace */}
          <p className="set-sub" style={{ color: "var(--ink)" }}>
            Delete workspace — permanently removes your family workspace, every saved session, and all
            members. This cannot be undone.
          </p>
          {!confirmDelete ? (
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete this workspace</button>
          ) : (
            <div>
              <p style={{ fontFamily: "var(--serif)", color: "var(--ink)", fontSize: 15, fontWeight: 500, marginBottom: 14 }}>
                Are you absolutely sure? This erases everything.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-danger-solid" onClick={deleteWorkspace} disabled={deleting}>
                  {deleting ? "Deleting…" : "Yes, delete forever"}
                </button>
                <button className="btn btn-soft" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
