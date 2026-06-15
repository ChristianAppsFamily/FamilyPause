import React, { useState } from 'react'
import './styles/tokens.css'
import './styles/screens.css'
import Auth from './components/Auth.jsx'
import Onboarding from './components/Onboarding.jsx'
import Settings from './components/Settings.jsx'
import Paywall from './components/Paywall.jsx'
import CardSystemRoot from './components/CardSystem.jsx'
import Landing from './components/Landing.jsx'
import App from './App.jsx'

const mockUser = { id: 'u1', email: 'spence@familypause.com' }
const mockWorkspace = {
  id: 'ws1', name: 'The Longmore Family', invite_code: 'FP-2026-AB12-0001',
  cards_unlocked: true, unlocked_deck_years: [2026], deck_unlocked_at: null,
  family_context: {
    people: ['Spence', 'Amanda', 'Jordan', 'Maya'], kids: ['Jordan', 'Maya'],
    businesses: ['Longmore Studio'], categories: ['Family', 'Kids', 'Business', 'Finance', 'Faith'],
  },
}
const PAGES = [
  { key: 'landing', label: 'Landing', render: () => <Landing onSignIn={() => {}} onStart={() => {}} /> },
  { key: 'app', label: 'App (5-step flow)', render: () => <App user={mockUser} workspace={mockWorkspace} onSignOut={() => {}} /> },
  { key: 'auth', label: 'Auth', render: () => <Auth onAuthenticated={() => {}} /> },
  { key: 'onboarding', label: 'Onboarding', render: () => <Onboarding workspaceId="ws1" displayName="Sarah" inviteCode="FP-2026-AB12-0001" joined={false} onComplete={() => {}} /> },
  { key: 'cards', label: 'Card System', render: () => <CardSystemRoot workspace={mockWorkspace} onStartSession={() => {}} onClose={() => {}} /> },
  { key: 'settings', label: 'Settings', render: () => <Settings workspace={mockWorkspace} user={mockUser} onSignOut={() => {}} onClose={() => {}} onOpenDecks={() => {}} /> },
  { key: 'paywall', label: 'Paywall', render: () => <Paywall reason="trial" onClose={() => {}} /> },
]

export default function Preview() {
  const [page, setPage] = useState('app')
  const current = PAGES.find((p) => p.key === page)
  return (
    <div>
      <div style={{
        position: 'sticky', top: 0, zIndex: 9999, display: 'flex', gap: 6, flexWrap: 'wrap',
        alignItems: 'center', padding: '8px 14px', background: '#2A251D',
        fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginRight: 8 }}>Preview</span>
        {PAGES.map((p) => (
          <button key={p.key} onClick={() => setPage(p.key)} style={{
            cursor: 'pointer', border: 'none', borderRadius: 5, padding: '6px 12px',
            fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
            background: page === p.key ? '#BE5A37' : 'rgba(255,255,255,0.10)',
            color: page === p.key ? '#fff' : 'rgba(255,255,255,0.65)',
          }}>{p.label}</button>
        ))}
      </div>
      <div key={page}>{current.render()}</div>
    </div>
  )
}
