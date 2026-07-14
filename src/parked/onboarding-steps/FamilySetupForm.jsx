/**
 * Parked from onboarding (Elon cut). Used as a post-Distill nudge in App.jsx.
 */
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import "../../styles/onboarding.css";

export default function FamilySetupForm({
  workspaceId,
  displayName,
  onSaved,
  onSkip,
  eyebrow = "Almost there",
  title = <>Who&apos;s in <em>your family</em>?</>,
  body = "FamilyPause uses these names to route action items to the right person.",
  primaryLabel = "Save names",
  skipLabel = "Skip for now",
}) {
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
    const family_context = {
      people: [...people, ...kids],
      kids,
      businesses,
      categories: ["Family", "Kids", "Business", "Finance", "Home", "Faith", "Health", "Dates"],
      family_names_nudge_dismissed_at: new Date().toISOString(),
    };
    const { data } = await supabase
      .from("workspaces")
      .update({ family_context })
      .eq("id", workspaceId)
      .select()
      .single();
    setLoading(false);
    onSaved?.(data || { family_context });
  };

  const handleSkip = async () => {
    setLoading(true);
    const { data: ws } = await supabase
      .from("workspaces")
      .select("family_context")
      .eq("id", workspaceId)
      .single();
    const prev = ws?.family_context && typeof ws.family_context === "object" ? ws.family_context : {};
    const family_context = {
      ...prev,
      family_names_nudge_dismissed_at: new Date().toISOString(),
    };
    const { data } = await supabase
      .from("workspaces")
      .update({ family_context })
      .eq("id", workspaceId)
      .select()
      .single();
    setLoading(false);
    onSkip?.(data || { family_context });
  };

  return (
    <div className="ob-page" style={{ minHeight: "auto", background: "transparent", padding: "24px 0" }}>
      <div className="ob-column" style={{ maxWidth: 480 }}>
        <div className="ob-anim" style={{ "--d": "0ms" }}><div className="ob-eyebrow">{eyebrow}</div></div>
        <h1 className="ob-anim ob-hl" style={{ "--d": "70ms" }}>{title}</h1>
        <p className="ob-anim ob-body" style={{ "--d": "140ms" }}>{body}</p>

        <div className="ob-anim ob-field-block" style={{ "--d": "210ms", marginTop: 28 }}>
          <label className="ob-field-label" htmlFor="nudge-spouse">Your spouse or partner&apos;s name</label>
          <input id="nudge-spouse" className="ob-text-input" type="text" placeholder="First name" value={spouseName} onChange={(e) => setSpouseName(e.target.value)} />
        </div>

        <div className="ob-anim ob-field-block" style={{ "--d": "280ms" }}>
          <label className="ob-field-label" htmlFor="nudge-kid">Kids&apos; names <span className="opt">Optional</span></label>
          <div className="ob-input-row">
            <input id="nudge-kid" className="ob-text-input" type="text" placeholder="Add a child&apos;s name" value={kidInput}
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
          <label className="ob-field-label" htmlFor="nudge-biz">Business or project names <span className="opt">Optional</span></label>
          <div className="ob-input-row">
            <input id="nudge-biz" className="ob-text-input" type="text" placeholder="Add a business or project" value={bizInput}
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
        </div>

        <div className="ob-anim" style={{ "--d": "420ms" }}>
          <button type="button" className="ob-btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? "Saving…" : primaryLabel}
          </button>
          <button type="button" className="ob-btn-ghost" onClick={handleSkip} disabled={loading}>{skipLabel}</button>
        </div>
      </div>
    </div>
  );
}
