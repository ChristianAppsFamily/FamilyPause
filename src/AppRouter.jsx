// ─────────────────────────────────────────────────────────────────────────────
// AppRouter.jsx - FamilyPause
// The top-level router. Handles:
//   - Auth session detection on load
//   - Routing between Auth → Onboarding → App
//   - Invite link detection (/join/:code)
// Drop into: src/AppRouter.jsx
// Replace src/main.jsx render target with <AppRouter />
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth";
import Onboarding from "./components/Onboarding";
import App from "./App"; // main FamilyPause app, src/App.jsx

const T = {
  bg:    "#FAF7F2",
  terra: "#B85C38",
  text:  "#2E2820",
  mid:   "#6A5A40",
};

// ── FULL-SCREEN LOADER ────────────────────────────────────────────────────────
function Loader() {
  return (
    <div style={{
      minHeight: "100vh",
      background: T.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 20,
      fontFamily: "'Georgia', serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: T.text }}>
        Family<span style={{ color: T.terra }}>Pause</span>
      </div>
      <div style={{
        width: 32, height: 32,
        border: `2px solid #D8CFC0`,
        borderTopColor: T.terra,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
    </div>
  );
}

// ── MAIN ROUTER ───────────────────────────────────────────────────────────────
export default function AppRouter() {
  const [phase, setPhase] = useState("loading"); // loading | auth | onboarding | app
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [onboardingData, setOnboardingData] = useState(null);

  // ── Detect invite link in URL ───────────────────────────────────────────────
  const inviteCodeFromUrl = (() => {
    const match = window.location.pathname.match(/\/join\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  })();

  // ── Check existing session on mount ────────────────────────────────────────
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // If there's an invite code in the URL, go straight to join screen
        setPhase("auth");
        return;
      }

      // Session exists, fetch workspace
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id, role, display_name, workspaces(*)")
        .eq("user_id", session.user.id)
        .single();

      if (membership?.workspaces) {
        setUser(session.user);
        setWorkspace(membership.workspaces);
        setPhase("app");
      } else {
        // Authenticated but no workspace, something went wrong, re-auth
        setUser(session.user);
        setPhase("auth");
      }
    };

    checkSession();

    // Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          setUser(null);
          setWorkspace(null);
          setOnboardingData(null);
          setPhase("auth");
        }
        if (event === "PASSWORD_RECOVERY") {
          // Handle password reset flow if needed
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Handle auth completion ──────────────────────────────────────────────────
  // Auth.jsx calls onAuthenticated(user, workspace) for returning users (two args)
  // or onAuthenticated({ newUser: true, ... }) for new users (one arg object).
  const handleAuthenticated = (userData, workspaceData) => {
    // New user, go to onboarding
    if (userData?.newUser) {
      setOnboardingData({
        workspaceId: userData.workspaceId,
        displayName: userData.displayName,
        inviteCode:  userData.inviteCode,
        joined:      userData.joined || false,
      });
      setPhase("onboarding");
      return;
    }

    // Existing user — userData is the real Supabase user object, workspaceData is the workspace row
    setUser(userData);
    setWorkspace(workspaceData || null);
    setPhase("app");
  };

  // ── Handle onboarding completion ────────────────────────────────────────────
  const handleOnboardingComplete = async () => {
    // Fetch the workspace now that onboarding is done
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, display_name, workspaces(*)")
      .eq("user_id", currentUser.id)
      .single();

    setUser(currentUser);
    setWorkspace(membership?.workspaces || null);
    setOnboardingData(null);
    setPhase("app");
  };

  // ── Handle sign out (called from within the App) ───────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange will fire and reset to auth phase
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  if (phase === "loading") return <Loader />;

  if (phase === "auth") return (
    <Auth
      onAuthenticated={handleAuthenticated}
      initialScreen={inviteCodeFromUrl ? "join" : "signin"}
      inviteCode={inviteCodeFromUrl || ""}
    />
  );

  if (phase === "onboarding" && onboardingData) return (
    <Onboarding
      workspaceId={onboardingData.workspaceId}
      displayName={onboardingData.displayName}
      inviteCode={onboardingData.inviteCode}
      joined={onboardingData.joined}
      onComplete={handleOnboardingComplete}
    />
  );

  if (phase === "app") return (
    <App
      user={user}
      workspace={workspace}
      onSignOut={handleSignOut}
    />
  );

  return <Loader />;
}
