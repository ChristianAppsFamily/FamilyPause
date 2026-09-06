// ─────────────────────────────────────────────────────────────────────────────
// AppRouter.jsx - FamilyPause
// The top-level router. Handles:
//   - Auth session detection on load
//   - Routing between Auth → Onboarding → App
//   - Invite link detection (/join/:code)
//   - Browser back/forward via URL sync
//   - Post-subscribe success (digital deck bump)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { ensureTrialSubscription } from "./lib/subscription";
import { triggerWelcomeEmail } from "./lib/welcomeEmail";
import {
  parseAppLocation,
  inviteCodeFromPath,
  onboardingPath,
  syncPath,
} from "./lib/routes";
import Auth from "./components/Auth";
import Onboarding from "./components/Onboarding";
import SubscribeSuccess from "./components/SubscribeSuccess";
import App from "./App";

const T = {
  bg:    "#FFFFFF",
  terra: "#B85C38",
  text:  "#2E2820",
  mid:   "#6A5A40",
};

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

export default function AppRouter() {
  const location = useLocation();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("loading"); // loading | auth | onboarding | app | subscribeSuccess
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [onboardingData, setOnboardingData] = useState(null);
  const [authBootstrapError, setAuthBootstrapError] = useState("");
  const bootstrapped = useRef(false);

  const inviteCodeFromUrl = inviteCodeFromPath(location.pathname);

  useEffect(() => {
    document.body.classList.add("fp-app");
    return () => document.body.classList.remove("fp-app");
  }, []);

  // ── Bootstrap session on mount ─────────────────────────────────────────────
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const parsed = parseAppLocation(location.pathname, location.search);

      if (!session) {
        setPhase("auth");
        bootstrapped.current = true;
        if (parsed.area === "sync" || parsed.area === "overlay" || parsed.area === "onboarding" || parsed.area === "subscribeSuccess") {
          navigate("/app", { replace: true });
        }
        return;
      }

      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id, role, display_name, workspaces(*)")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (membership?.workspaces) {
        setUser(session.user);
        setWorkspace(membership.workspaces);
        bootstrapped.current = true;
        setAuthBootstrapError("");

        if (parsed.area === "subscribeSuccess") {
          setPhase("subscribeSuccess");
          return;
        }

        setPhase("app");

        if (parsed.area === "onboarding") {
          navigate(syncPath("agenda"), { replace: true });
        } else if (parsed.area === "auth" || parsed.area === "unknown") {
          navigate(syncPath("agenda"), { replace: true });
        }
        return;
      }

      const name =
        session.user.user_metadata?.full_name?.split(" ")[0] ||
        session.user.email?.split("@")[0] ||
        "Friend";
      const { data: ws, error: wsErr } = await supabase.rpc("create_owner_workspace", { p_name: name });
      if (wsErr) {
        console.error("create_owner_workspace failed:", wsErr);
        setAuthBootstrapError("Couldn’t create your family workspace. Try again.");
        setUser(session.user);
        setPhase("auth");
        bootstrapped.current = true;
        return;
      }
      setAuthBootstrapError("");
      const newWorkspace = Array.isArray(ws) ? ws[0] : ws;
      await ensureTrialSubscription(newWorkspace.id);
      triggerWelcomeEmail({
        email: session.user.email,
        firstName: name,
        enrollDrip: true,
      });
      setUser(session.user);
      setOnboardingData({
        workspaceId: newWorkspace.id,
        displayName: name,
        inviteCode: newWorkspace.invite_code,
        joined: false,
      });
      setPhase("onboarding");
      bootstrapped.current = true;

      if (parsed.area !== "onboarding") {
        navigate(onboardingPath(1), { replace: true });
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          setUser(null);
          setWorkspace(null);
          setOnboardingData(null);
          setPhase("auth");
          navigate("/app", { replace: true });
        }
        if (event === "PASSWORD_RECOVERY") {
          window.location.href = "/reset-password";
        }
      }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keep phase in sync with browser back/forward ───────────────────────────
  useEffect(() => {
    if (!bootstrapped.current || phase === "loading") return;

    const parsed = parseAppLocation(location.pathname, location.search);

    if (user && parsed.area === "subscribeSuccess") {
      if (phase !== "subscribeSuccess") setPhase("subscribeSuccess");
      return;
    }

    if (user && parsed.area === "auth") {
      if (onboardingData) {
        if (phase !== "onboarding") setPhase("onboarding");
        navigate(onboardingPath(1), { replace: true });
        return;
      }
      navigate(syncPath("agenda"), { replace: true });
      if (phase !== "app") setPhase("app");
      return;
    }

    if (parsed.area === "onboarding") {
      if (user && onboardingData) {
        if (phase !== "onboarding") setPhase("onboarding");
      } else if (user && !onboardingData) {
        navigate(syncPath("agenda"), { replace: true });
      } else if (!user) {
        setPhase("auth");
        navigate("/app", { replace: true });
      }
      return;
    }

    if (user && (parsed.area === "sync" || parsed.area === "overlay")) {
      if (phase !== "app") setPhase("app");
      return;
    }

    if (!user && (parsed.area === "sync" || parsed.area === "overlay" || parsed.area === "subscribeSuccess")) {
      setPhase("auth");
      navigate("/app", { replace: true });
      return;
    }

    if (!user && parsed.area === "auth" && phase !== "auth") {
      setPhase("auth");
    }

    if (user && phase === "app" && parsed.area === "unknown") {
      navigate(syncPath("agenda"), { replace: true });
    }
  }, [location.pathname, location.search, phase, user, onboardingData, navigate]);

  const handleAuthenticated = async (userData, workspaceData) => {
    if (userData?.newUser) {
      const joined = userData.joined || false;
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      setOnboardingData({
        workspaceId: userData.workspaceId,
        displayName: userData.displayName,
        inviteCode:  userData.inviteCode,
        joined,
      });
      setPhase("onboarding");
      navigate(onboardingPath(1), { replace: true });
      return;
    }

    setUser(userData);
    setWorkspace(workspaceData || null);
    setPhase("app");
    navigate(syncPath("agenda"), { replace: true });
  };

  const handleOnboardingComplete = async () => {
    const wsId = onboardingData?.workspaceId;
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setOnboardingData(null);
        setPhase("auth");
        navigate("/app", { replace: true });
        return;
      }

      let ws = null;
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id, role, display_name, workspaces(*)")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (membership?.workspaces) {
        ws = membership.workspaces;
      } else if (wsId) {
        const { data } = await supabase.from("workspaces").select("*").eq("id", wsId).maybeSingle();
        ws = data;
      }

      setUser(currentUser);
      setWorkspace(ws);
      setOnboardingData(null);
      setPhase("app");
      navigate(syncPath("agenda"), { replace: true });
    } catch (err) {
      console.error("Onboarding complete failed:", err);
      if (wsId) {
        const { data } = await supabase.from("workspaces").select("*").eq("id", wsId).maybeSingle();
        setWorkspace(data);
      }
      setOnboardingData(null);
      setPhase("app");
      navigate(syncPath("agenda"), { replace: true });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (phase === "loading") return <Loader />;

  if (phase === "auth") return (
    <Auth
      onAuthenticated={handleAuthenticated}
      inviteCode={inviteCodeFromUrl || ""}
      bootstrapError={authBootstrapError}
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

  if (phase === "subscribeSuccess" && user && workspace) {
    return (
      <SubscribeSuccess
        workspace={workspace}
        onWorkspaceUpdate={setWorkspace}
        onContinue={() => {
          setPhase("app");
          navigate(syncPath("agenda"), { replace: true });
        }}
      />
    );
  }

  if (phase === "app") return (
    <App
      user={user}
      workspace={workspace}
      onSignOut={handleSignOut}
    />
  );

  return <Loader />;
}
