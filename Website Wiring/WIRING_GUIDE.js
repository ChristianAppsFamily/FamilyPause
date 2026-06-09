// ─────────────────────────────────────────────────────────────────────────────
// FILE 1: src/lib/supabase.js
// ─────────────────────────────────────────────────────────────────────────────
// Create the folder: src/lib/
// Create the file:   src/lib/supabase.js
// Paste this content:

/*
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
*/


// ─────────────────────────────────────────────────────────────────────────────
// FILE 2: src/main.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Replace the ENTIRE contents of src/main.jsx with this:

/*
import React from 'react'
import ReactDOM from 'react-dom/client'
import AppRouter from './AppRouter.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
)
*/


// ─────────────────────────────────────────────────────────────────────────────
// FILE 3: .env.local (in project ROOT, not in src/)
// ─────────────────────────────────────────────────────────────────────────────
// Create this file in the root of your project (same level as package.json)
// NEVER commit this file — make sure .env.local is in your .gitignore

/*
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-key-here
VITE_ANTHROPIC_KEY=sk-ant-api03-...your-key-here
*/


// ─────────────────────────────────────────────────────────────────────────────
// FILE STRUCTURE — your src/ folder should look like this:
// ─────────────────────────────────────────────────────────────────────────────

/*
familypause/
├── .env.local                ← your secret keys (never commit)
├── .gitignore                ← make sure .env.local is listed here
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx              ← renders <AppRouter />
    ├── AppRouter.jsx         ← top-level router (auth/onboarding/app)
    ├── App.jsx               ← your main FamilyPause app
    ├── lib/
    │   └── supabase.js       ← supabase client
    └── components/
        ├── Auth.jsx          ← sign in / sign up / forgot / join
        └── Onboarding.jsx    ← 4-step new user setup
*/


// ─────────────────────────────────────────────────────────────────────────────
// HOW THE ROUTING WORKS
// ─────────────────────────────────────────────────────────────────────────────

/*
URL: familypause.com
  → AppRouter checks for existing Supabase session
  → No session → Auth (sign in screen)
  → Session exists + workspace → App (main FamilyPause app)

URL: familypause.com/join/xK9m2p
  → AppRouter detects invite code in URL
  → Auth renders with Join screen pre-selected
  → User creates account → joins workspace → Onboarding (joined flow) → App

New sign up flow:
  Sign Up → Supabase creates user → workspace created → Onboarding step 1-4 → App

Sign in flow:
  Sign In → Supabase validates → fetch workspace membership → App

Sign out:
  App calls onSignOut() → supabase.auth.signOut() → onAuthStateChange fires → Auth
*/


// ─────────────────────────────────────────────────────────────────────────────
// UPDATING App.jsx TO ACCEPT USER + WORKSPACE PROPS
// ─────────────────────────────────────────────────────────────────────────────
// At the top of your App.jsx (the main FamilyPause app), update the
// default export signature from:
//
//   export default function FamilyPause() {
//
// to:
//
//   export default function App({ user, workspace, onSignOut }) {
//
// Then use workspace.family_context to pre-populate the AI context:
//
//   const [context, setContext] = useState(
//     workspace?.family_context || DEFAULT_CONTEXT
//   );
//
// And add a sign out button in your header:
//
//   <button onClick={onSignOut} style={{...}}>Sign Out</button>


// ─────────────────────────────────────────────────────────────────────────────
// SAVING SESSIONS TO SUPABASE
// ─────────────────────────────────────────────────────────────────────────────
// After the user completes a FamilyPause session (cards reviewed),
// save it to the sessions table:
//
//   const saveSession = async () => {
//     await supabase.from('sessions').insert({
//       workspace_id: workspace.id,
//       meeting_date: meetingDate,
//       transcript:   inputMode === 'record' ? transcript : pasteText,
//       input_mode:   inputMode,
//       cards:        cards,
//       status:       'complete',
//       created_by:   user.id,
//     });
//   };
//
// Call saveSession() when the user hits "See Plan" or after review is done.


// ─────────────────────────────────────────────────────────────────────────────
// REALTIME SYNC BETWEEN SPENCE AND AMANDA
// ─────────────────────────────────────────────────────────────────────────────
// Add this inside your App component to listen for live card updates:
//
//   useEffect(() => {
//     if (!workspace?.id) return;
//
//     const channel = supabase
//       .channel('session-sync')
//       .on(
//         'postgres_changes',
//         {
//           event:  'UPDATE',
//           schema: 'public',
//           table:  'sessions',
//           filter: `workspace_id=eq.${workspace.id}`,
//         },
//         (payload) => {
//           // Another device updated the session — sync cards
//           if (payload.new.cards) {
//             setCards(payload.new.cards);
//           }
//         }
//       )
//       .subscribe();
//
//     return () => supabase.removeChannel(channel);
//   }, [workspace?.id]);
