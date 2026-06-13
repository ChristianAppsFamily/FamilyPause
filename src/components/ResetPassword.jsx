import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

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
    <div style={{ minHeight: "100vh", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--paper-card)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: "36px 32px", boxShadow: "var(--shadow)" }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Account</div>
        <h1 style={{ fontFamily: "var(--display)", fontSize: 32, fontWeight: 600, marginBottom: 8 }}>Set a new password</h1>
        <p style={{ fontFamily: "var(--body)", color: "var(--ink-2)", fontSize: 15, marginBottom: 28 }}>
          {done ? "Password updated. Taking you to the app…" : ready ? "Choose a new password for your FamilyPause account." : "Confirming your reset link…"}
        </p>

        {!done && ready && (
          <>
            {error && (
              <div style={{ background: "var(--red-tint)", border: "1px solid var(--red-soft)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 14, color: "var(--red)" }}>
                {error}
              </div>
            )}
            <label className="eyebrow" style={{ display: "block", marginBottom: 8, color: "var(--ink-2)" }}>New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", fontFamily: "var(--body)", fontSize: 15, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 16, outline: "none" }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <label className="eyebrow" style={{ display: "block", marginBottom: 8, color: "var(--ink-2)" }}>Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ width: "100%", fontFamily: "var(--body)", fontSize: 15, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 24, outline: "none" }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button type="button" className="btn btn-primary btn-block" onClick={submit} disabled={loading}>
              {loading ? "Saving…" : "Update password"}
            </button>
          </>
        )}

        {!ready && !done && (
          <div style={{ width: 32, height: 32, border: "2px solid var(--line)", borderTopColor: "var(--terra)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
