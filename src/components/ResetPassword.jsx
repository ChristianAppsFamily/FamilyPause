import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { AuthShell } from "./Auth.jsx";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let sub;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
        return;
      }
      sub = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) setReady(true);
      }).data.subscription;
    });
    return () => sub?.unsubscribe();
  }, []);

  const submit = async () => {
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => navigate("/app"), 1800);
  };

  return (
    <AuthShell>
      <div className="fp-fade">
        <div style={{ fontSize: 11, letterSpacing: "0.25em", color: "var(--terra)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", marginBottom: 12 }}>
          Account
        </div>
        <h1 className="form-hl">Set a new password</h1>
        <p className="form-sub">
          {done ? "Password updated. Taking you to the app…" : ready ? "Choose a new password for your FamilyPause account." : "Confirming your reset link…"}
        </p>
      </div>

      {!done && ready && (
        <>
          {error && (
            <div style={{ background: "#FBEAE5", border: "1px solid #F6DAD3", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 14, color: "#C0402F" }}>
              {error}
            </div>
          )}
          <div className="fp-fade-1 fp-field" style={{ marginBottom: 16 }}>
            <label className="fp-label">New password</label>
            <input
              className="fp-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <div className="fp-fade-2 fp-field" style={{ marginBottom: 24 }}>
            <label className="fp-label">Confirm password</label>
            <input
              className="fp-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <button type="button" className="fp-btn-primary fp-fade-3" onClick={submit} disabled={loading}>
            {loading ? "Saving…" : "Update password"}
          </button>
        </>
      )}

      {!ready && !done && (
        <div style={{ width: 32, height: 32, border: "2px solid #E6D9C4", borderTopColor: "#BE5A37", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "24px auto 0" }} />
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </AuthShell>
  );
}
