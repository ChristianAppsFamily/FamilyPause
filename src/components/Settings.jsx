// ─────────────────────────────────────────────────────────────────────────────
// Settings.jsx - FamilyPause
// Visual source of truth: project/app/styles.css + screens.css (design bundle).
// Composes the shared design classes from src/styles/tokens.css.
// Sections: Subscription, Card decks, Family members, Invite code,
//           Sounds, Calendar, Sign out, Danger zone
//
// Props:
//   workspace   { id, name, invite_code, family_context, unlocked_deck_years, cards_unlocked }
//   user        supabase auth user
//   onSignOut() called to sign the user out (passed from AppRouter)
//   onClose()   optional: return to the main app
//   onOpenDecks() optional: open the CardSystem unlock flow
//   onOpenDecks() optional: open CardSystem overlay
//   onWorkspaceUpdate(updatedWorkspace) optional: bubble saved workspace up
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

/** Parked: set true to restore Invite code / spouse join in Settings. */
const SHOW_INVITE_SPOUSE = false;
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { openStripeCheckout } from "../lib/stripeCheckout";
import { trialDaysRemaining as getTrialDaysRemaining, isPaidPlan } from "../lib/subscription";
import {
  setLocalSoundsEnabled,
  soundsEnabledForWorkspace,
} from "../lib/sounds";
import {
  getCalendarConnection,
  startGoogleCalendarConnect,
  disconnectGoogleCalendar,
} from "../lib/googleCalendar";
import CalendarAccountChooser from "./CalendarAccountChooser";
import ReminderPicker, {
  DEFAULT_REMINDER_DAY,
  DEFAULT_REMINDER_TIME,
  formatReminderDay,
  formatReminderTime,
  normalizeReminderDay,
  normalizeReminderTime,
} from "./ReminderPicker";
import "../styles/reminder.css";

const css = `
  .set-sec { padding: 24px 26px; margin-bottom: 18px; }
  .set-sec .eyebrow { margin-bottom: 9px; }
  .set-sec > h2 { font-size: 23px; margin-bottom: 18px; }
  .set-sub { color: var(--ink-2); font-size: 15px; line-height: 1.55; margin: 0 0 16px; }
  .set-inline-link {
    color: inherit;
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .set-inline-link:hover { color: var(--terra); }
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
  .set-upgrade {
    margin-top: 16px; padding: 16px 16px 14px;
    background: var(--terra-tint); border: 1px solid var(--terra-soft);
    border-radius: var(--r); animation: setUpgradeIn .18s ease both;
  }
  @keyframes setUpgradeIn {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: none; }
  }
  .set-upgrade-title {
    font-family: var(--display); font-size: 18px; font-weight: 600;
    color: var(--ink); margin: 0 0 6px;
  }
  .set-upgrade-sub {
    font-family: var(--serif); font-size: 14px; color: var(--ink-2);
    line-height: 1.45; margin: 0 0 14px;
  }
  .set-billing {
    display: inline-flex; gap: 4px; padding: 4px;
    background: var(--paper-2); border-radius: 999px; margin-bottom: 14px;
  }
  .set-billing button {
    font-family: var(--mono); font-size: 11px; letter-spacing: .06em;
    text-transform: uppercase; border: none; background: transparent;
    color: var(--ink-3); padding: 8px 14px; border-radius: 999px; cursor: pointer;
  }
  .set-billing button.on {
    background: var(--paper-card); color: var(--terra-d);
    box-shadow: var(--shadow-sm); font-weight: 500;
  }
  .set-upgrade-price {
    display: flex; align-items: baseline; gap: 6px; margin-bottom: 14px;
  }
  .set-upgrade-price .amt {
    font-family: var(--display); font-size: 32px; font-weight: 600; color: var(--ink);
  }
  .set-upgrade-price .per {
    font-family: var(--mono); font-size: 12px; color: var(--ink-3);
  }
  .set-toggle {
    display: inline-flex; align-items: center; gap: 12px;
    border: 1px solid var(--line); background: var(--paper-2);
    border-radius: 999px; padding: 6px 6px 6px 14px; cursor: pointer;
    font-family: var(--mono); font-size: 11px; letter-spacing: .08em;
    text-transform: uppercase; color: var(--ink-2); user-select: none;
    transition: border-color .15s, background .15s, color .15s;
  }
  .set-toggle:hover:not(:disabled) { border-color: var(--line-2); }
  .set-toggle:disabled { opacity: .65; cursor: not-allowed; }
  .set-toggle.is-on {
    background: var(--terra-tint); border-color: var(--terra-soft); color: var(--terra-d);
  }
  .set-toggle-track {
    width: 42px; height: 24px; border-radius: 999px; flex-shrink: 0;
    background: var(--line-2); position: relative;
    transition: background .15s;
  }
  .set-toggle.is-on .set-toggle-track { background: var(--terra); }
  .set-toggle-thumb {
    position: absolute; top: 3px; left: 3px;
    width: 18px; height: 18px; border-radius: 50%;
    background: #fff; box-shadow: var(--shadow-sm);
    transition: transform .15s ease;
  }
  .set-toggle.is-on .set-toggle-thumb { transform: translateX(18px); }

  .set-cal-label {
    font-family: var(--mono); font-size: 9px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--ink-3); margin-bottom: 8px;
  }
  .set-cal-account {
    display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
  }
  .set-cal-dot {
    width: 7px; height: 7px; border-radius: 50%; background: var(--olive); flex-shrink: 0;
  }
  .set-cal-email {
    font-family: var(--mono); font-size: 12px; letter-spacing: .02em; color: #6A5A40;
  }
  .set-cal-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .set-btn-ghost-warm {
    font-family: var(--lora); font-size: 14px; padding: 10px 18px; border-radius: 8px;
    background: transparent; border: 1px solid #D8CFC0; color: #6A5A40; cursor: pointer;
    transition: color .15s, border-color .15s;
  }
  .set-btn-ghost-warm:hover:not(:disabled) { color: var(--terra); border-color: var(--terra); }
  .set-btn-ghost-warm:disabled { opacity: .55; cursor: not-allowed; }
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
export default function Settings({ workspace, user, onSignOut, onClose, onOpenDecks, onWorkspaceUpdate }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutSuccess = searchParams.get("checkout") === "success";
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
  const [checkoutNotice, setCheckoutNotice] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [familyBilling, setFamilyBilling] = useState("monthly");
  const [calendarConn, setCalendarConn] = useState({
    connected: false, connectedAt: null, memberId: null, googleEmail: null,
  });
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarDisconnecting, setCalendarDisconnecting] = useState(false);
  const [calendarNotice, setCalendarNotice] = useState("");
  const [calendarChooserOpen, setCalendarChooserOpen] = useState(false);
  const [calendarConnecting, setCalendarConnecting] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [soundsEnabled, setSoundsEnabled] = useState(() => soundsEnabledForWorkspace(workspace));
  const [reminderDay, setReminderDay] = useState(() => normalizeReminderDay(workspace?.reminder_day));
  const [reminderTime, setReminderTime] = useState(() => normalizeReminderTime(workspace?.reminder_time));
  const [reminderEditing, setReminderEditing] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderSaved, setReminderSaved] = useState(false);

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
  const loadSubscription = async () => {
    if (!workspace?.id) { setSubLoading(false); return; }
    setSubLoading(true);
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setSubscription(data || null);
    } catch { /* offline / no subscription row: fall back to free plan */ }
    finally { setSubLoading(false); }
  };

  useEffect(() => {
    loadSubscription();
  }, [workspace?.id]);

  useEffect(() => {
    if (!checkoutSuccess) return;
    setCheckoutNotice(true);
    loadSubscription();
    if (onWorkspaceUpdate && workspace?.id) {
      supabase.from("workspaces").select("*").eq("id", workspace.id).single()
        .then(({ data }) => { if (data) onWorkspaceUpdate(data); });
    }
    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    setSearchParams(next, { replace: true });
  }, [checkoutSuccess]);

  useEffect(() => {
    setSoundsEnabled(soundsEnabledForWorkspace(workspace));
  }, [workspace?.id]);

  useEffect(() => {
    setReminderDay(normalizeReminderDay(workspace?.reminder_day));
    setReminderTime(normalizeReminderTime(workspace?.reminder_time));
    setReminderEditing(false);
  }, [workspace?.id, workspace?.reminder_day, workspace?.reminder_time]);

  const loadCalendarConnection = async () => {
    if (!workspace?.id || !user?.id) {
      setCalendarLoading(false);
      return;
    }
    setCalendarLoading(true);
    const conn = await getCalendarConnection(workspace.id, user.id);
    setCalendarConn(conn);
    setCalendarLoading(false);
  };

  useEffect(() => {
    loadCalendarConnection();
  }, [workspace?.id, user?.id]);

  useEffect(() => {
    const cal = searchParams.get("calendar");
    if (cal === "connected") {
      setCalendarNotice("Google Calendar connected.");
      loadCalendarConnection();
      const next = new URLSearchParams(searchParams);
      next.delete("calendar");
      setSearchParams(next, { replace: true });
    } else if (cal === "error") {
      const raw = searchParams.get("msg") || "Could not connect Google Calendar.";
      const friendly = /invalid_client/i.test(raw)
        ? "Google Calendar is not configured yet. Ask the workspace owner to finish Google Cloud OAuth setup in Supabase."
        : raw;
      setCalendarNotice(friendly);
      setCalendarChooserOpen(false);
      const next = new URLSearchParams(searchParams);
      next.delete("calendar");
      next.delete("msg");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams.get("calendar")]);

  const connectCalendar = async () => {
    if (!workspace?.id) return;
    setCalendarConnecting(true);
    setCalendarNotice("");
    try {
      await startGoogleCalendarConnect(workspace.id, "/app/settings?calendar=connected");
    } catch (e) {
      setCalendarNotice(e.message || "Could not start Google Calendar connect.");
      setCalendarConnecting(false);
    }
  };

  const disconnectCalendar = async () => {
    if (!calendarConn.memberId) return;
    setCalendarDisconnecting(true);
    await disconnectGoogleCalendar(calendarConn.memberId);
    setCalendarConn({
      connected: false,
      connectedAt: null,
      memberId: calendarConn.memberId,
      googleEmail: null,
    });
    setCalendarChooserOpen(false);
    setCalendarDisconnecting(false);
  };

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

  const sendInviteSms = () => {
    const code = workspace?.invite_code || "";
    if (!code) return;
    const body = encodeURIComponent(`Join our FamilyPause workspace: ${code}\nhttps://familypause.com/join/${code}`);
    window.location.href = `sms:?&body=${body}`;
  };

  const toggleSounds = () => {
    if (!workspace?.id) return;
    const next = !soundsEnabled;
    setError("");
    setSoundsEnabled(next);
    setLocalSoundsEnabled(workspace.id, next);
    onWorkspaceUpdate?.({ ...workspace, sounds_enabled: next });

    // Best-effort DB sync — never revert UI if this fails (column/RLS may be missing).
    void supabase
      .from("workspaces")
      .update({ sounds_enabled: next })
      .eq("id", workspace.id)
      .then(({ error: err }) => {
        if (err) console.warn("[Settings] sounds_enabled sync failed", err.message);
      });
  };

  const saveReminder = async () => {
    if (!workspace?.id || reminderSaving) return;
    setReminderSaving(true);
    setError("");
    const day = normalizeReminderDay(reminderDay);
    const time = normalizeReminderTime(reminderTime);
    const { data, error: err } = await supabase
      .from("workspaces")
      .update({ reminder_day: day, reminder_time: time })
      .eq("id", workspace.id)
      .select("*")
      .maybeSingle();
    setReminderSaving(false);
    if (err) {
      setError(err.message || "Couldn't save reminder.");
      return;
    }
    setReminderDay(day);
    setReminderTime(time);
    setReminderEditing(false);
    setReminderSaved(true);
    setTimeout(() => setReminderSaved(false), 2500);
    onWorkspaceUpdate?.(data || { ...workspace, reminder_day: day, reminder_time: time });
  };

  // ── Plan + trial ───────────────────────────────────────────────────────────
  const planLabel = (() => {
    const p = subscription?.plan || "free";
    return { free: "Free", family: "Family Plan", pro: "Family Pro", ministry: "Church / Ministry" }[p] || p;
  })();

  const trialDaysRemaining = getTrialDaysRemaining(subscription);

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

        {/* ── SUBSCRIPTION ───────────────────────────────────────────── */}
        <section className="panel set-sec rise">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 9 }}>Your plan</div>
              <h2 style={{ margin: 0 }}>Subscription</h2>
            </div>
            {!isPaidPlan(subscription) && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ flexShrink: 0, marginTop: 4 }}
                aria-expanded={upgradeOpen}
                onClick={() => setUpgradeOpen((o) => !o)}
              >
                {upgradeOpen ? "Close" : "Upgrade"}
              </button>
            )}
          </div>
          {subLoading ? (
            <div className="set-spin" />
          ) : (
            <div>
              <div className="set-plan">
                <span className="name">{planLabel}</span>
                {subscription?.active && <span className="tag tag-amanda">Active</span>}
              </div>
              {checkoutNotice && (
                <p className="set-sub" style={{ margin: "0 0 12px", color: "var(--olive-d)" }}>
                  Thanks, your plan should update shortly.
                </p>
              )}
              {(subscription?.plan === "free" || !subscription) && !isPaidPlan(subscription) && trialDaysRemaining !== null && (
                <p className="set-sub" style={{ margin: 0 }}>
                  {trialDaysRemaining > 0
                    ? `${trialDaysRemaining} trial day${trialDaysRemaining === 1 ? "" : "s"} remaining.`
                    : "Your free trial has ended. Upgrade for unlimited AI sessions, or use manual review."}
                </p>
              )}
              {!subscription && trialDaysRemaining === null && (
                <p className="set-sub" style={{ margin: 0 }}>You&apos;re on the free plan. Upgrade for unlimited AI sessions.</p>
              )}

              {upgradeOpen && !isPaidPlan(subscription) && (
                <div className="set-upgrade" role="region" aria-label="Choose Family Plan billing">
                  <div className="set-upgrade-title">Family Plan</div>
                  <p className="set-upgrade-sub">
                    Unlimited AI sessions, spouse sync, plan history, and PDF exports.
                  </p>
                  <div className="set-billing" role="group" aria-label="Billing period">
                    <button
                      type="button"
                      className={familyBilling === "monthly" ? "on" : ""}
                      aria-pressed={familyBilling === "monthly"}
                      onClick={() => setFamilyBilling("monthly")}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      className={familyBilling === "annual" ? "on" : ""}
                      aria-pressed={familyBilling === "annual"}
                      onClick={() => setFamilyBilling("annual")}
                    >
                      Yearly
                    </button>
                  </div>
                  <div className="set-upgrade-price">
                    <span className="amt">{familyBilling === "monthly" ? "$9" : "$79"}</span>
                    <span className="per">{familyBilling === "monthly" ? "/ month" : "/ year"}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={() => {
                      void openStripeCheckout(
                        familyBilling === "monthly" ? "family_monthly" : "family",
                      );
                    }}
                  >
                    {familyBilling === "monthly"
                      ? "Continue with Monthly, $9"
                      : "Continue with Yearly, $79"}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── CARD DECKS ─────────────────────────────────────────────── */}
        <section className="panel set-sec rise">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 9 }}>Conversation cards</div>
              <h2 style={{ margin: 0 }}>Conversation Cards</h2>
            </div>
            {onOpenDecks && (
              <button className="btn btn-primary" onClick={onOpenDecks} style={{ flexShrink: 0, marginTop: 4 }}>
                {unlockedDecks.length > 0 ? "Open library" : "Unlock now"}
              </button>
            )}
          </div>
          {unlockedDecks.length > 0 ? (
            <div className="set-chips" style={{ marginBottom: 4 }}>
              {unlockedDecks.map((yr) => <span key={yr} className="set-deckpill">{yr} Conversation Cards</span>)}
            </div>
          ) : (
            <p className="set-sub" style={{ margin: 0 }}>
              You haven&apos;t unlocked Conversation Cards yet. Unlock the Conversation Starter Card Deck to draw a
              conversation card together each week.
            </p>
          )}
        </section>

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

        {/* ── INVITE CODE (parked) ───────────────────────────────────── */}
        {SHOW_INVITE_SPOUSE && (
        <section className="panel set-sec rise">
          <div className="eyebrow">Bring in your spouse</div>
          <h2>Invite code</h2>
          <p className="set-sub">Share this code so your spouse can join the same family workspace.</p>
          <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
            <div className="set-codebox">{workspace?.invite_code || "Not set"}</div>
            <button className="btn btn-soft" onClick={copyInvite}>{copied ? "Copied ✓" : "Copy"}</button>
            <button className="btn btn-soft" type="button" onClick={sendInviteSms}>Send via Text</button>
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
        )}

        {/* ── WEEKLY REMINDER ────────────────────────────────────────── */}
        <section className="panel set-sec rise">
          <div className="eyebrow">Weekly rhythm</div>
          <h2>Reminder</h2>
          <p className="set-sub">
            We&apos;ll email you once a week so you and your spouse sit down together.
          </p>
          {reminderEditing ? (
            <div>
              <ReminderPicker
                idPrefix="set-reminder"
                day={reminderDay}
                time={reminderTime}
                onDayChange={setReminderDay}
                onTimeChange={setReminderTime}
              />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveReminder}
                  disabled={reminderSaving}
                >
                  {reminderSaving ? "Saving…" : "Save reminder"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setReminderDay(normalizeReminderDay(workspace?.reminder_day ?? DEFAULT_REMINDER_DAY));
                    setReminderTime(normalizeReminderTime(workspace?.reminder_time ?? DEFAULT_REMINDER_TIME));
                    setReminderEditing(false);
                  }}
                  disabled={reminderSaving}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: "var(--display)", fontSize: 22, color: "var(--ink)" }}>
                  {formatReminderDay(reminderDay)} · {formatReminderTime(reminderTime)}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".04em", color: "var(--ink-3)", marginTop: 4 }}>
                  Pacific time
                </div>
                {reminderSaved && <div className="set-saved" style={{ marginTop: 8 }}>✓ Saved</div>}
              </div>
              <button type="button" className="btn btn-soft" onClick={() => setReminderEditing(true)}>
                Edit
              </button>
            </div>
          )}
        </section>

        {/* ── SOUNDS ─────────────────────────────────────────────────── */}
        <section className="panel set-sec rise">
          <div className="eyebrow">Experience</div>
          <h2>Sounds</h2>
          <p className="set-sub">
            Gentle completion chime when your week is built, and a paper flip when you draw a conversation card.
            Respects your device mute switch and accessibility motion settings.
          </p>
          <button
            type="button"
            className={"set-toggle" + (soundsEnabled ? " is-on" : "")}
            onClick={toggleSounds}
            aria-pressed={soundsEnabled}
            aria-label={soundsEnabled ? "Sounds on" : "Sounds off"}
          >
            <span>{soundsEnabled ? "Sounds on" : "Sounds off"}</span>
            <span className="set-toggle-track" aria-hidden="true">
              <span className="set-toggle-thumb" />
            </span>
          </button>
        </section>

        {/* ── GOOGLE CALENDAR ─────────────────────────────────────────── */}
        <section className="panel set-sec rise">
          <div className="eyebrow">Integrations</div>
          <h2>Google Calendar</h2>
          {!calendarChooserOpen && (
            <p className="set-sub">
              Connect a Google account to add dated items from your weekly plan directly to your calendar.
              Your FamilyPause login and your Google account can be different, you&apos;ll choose which Google account to link.
              {" "}Planning together? Connect the Google account tied to a calendar you both already have access to.
              Don&apos;t have one set up together yet?{" "}
              <a
                className="set-inline-link"
                href="https://support.google.com/calendar/answer/37082"
                target="_blank"
                rel="noopener noreferrer"
              >
                Here&apos;s how to share a calendar in Google Calendar
              </a>{" "}
              in under a minute.
            </p>
          )}
          {calendarNotice && (
            <p className="set-sub" style={{
              margin: "0 0 12px",
              color: /connected/i.test(calendarNotice) ? "var(--olive-d)" : "var(--red)",
            }}>
              {calendarNotice}
            </p>
          )}
          {calendarLoading ? (
            <div className="set-spin" />
          ) : calendarConn.connected ? (
            <div>
              <div className="set-cal-label">Connected account</div>
              <div className="set-cal-account">
                <span className="set-cal-dot" aria-hidden="true" />
                <span className="set-cal-email">
                  {calendarConn.googleEmail || "Google account linked"}
                </span>
              </div>
              {calendarConn.connectedAt && (
                <p className="set-sub" style={{ margin: "0 0 12px", fontSize: 13 }}>
                  Linked {new Date(calendarConn.connectedAt).toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </p>
              )}
              {user?.email && calendarConn.googleEmail
                && user.email.toLowerCase() !== calendarConn.googleEmail.toLowerCase() && (
                <p className="set-sub" style={{ margin: "0 0 12px", fontSize: 13 }}>
                  FamilyPause: {user.email}
                </p>
              )}
              <div className="set-cal-actions">
                <button
                  type="button"
                  className="set-btn-ghost-warm"
                  onClick={() => window.open("https://calendar.google.com", "_blank", "noopener,noreferrer")}
                >
                  Open Google Calendar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={calendarDisconnecting}
                  onClick={disconnectCalendar}
                >
                  {calendarDisconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            </div>
          ) : calendarChooserOpen ? (
            <CalendarAccountChooser
              onConfirm={connectCalendar}
              onCancel={() => setCalendarChooserOpen(false)}
              busy={calendarConnecting}
            />
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { setCalendarNotice(""); setCalendarChooserOpen(true); }}
            >
              Connect Google Calendar
            </button>
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
              Change password. We&apos;ll send a reset link to {user?.email || "your email"}.
            </p>
            {pwSent ? (
              <p style={{ fontFamily: "var(--mono)", fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--olive-d)" }}>
                ✓ Reset link sent. Check your inbox
              </p>
            ) : (
              <button className="btn btn-ghost" onClick={sendPasswordReset} disabled={pwSending}>
                {pwSending ? "Sending…" : "Send password reset"}
              </button>
            )}
          </div>

          {/* Delete workspace */}
          <p className="set-sub" style={{ color: "var(--ink)" }}>
            Delete workspace. Permanently removes your family workspace, every saved session, and all
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
