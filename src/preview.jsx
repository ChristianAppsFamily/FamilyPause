import React, { useState } from 'react'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter } from 'react-router-dom'
import './styles/tokens.css'
import './styles/screens.css'
import Auth from './components/Auth.jsx'
import Onboarding from './components/Onboarding.jsx'
import Settings from './components/Settings.jsx'
import Paywall from './components/Paywall.jsx'
import CardSystemRoot from './components/CardSystem.jsx'
import Landing from './components/Landing.jsx'
import App from './App.jsx'
import PlanView from './components/PlanView.jsx'

const mockUser = { id: 'u1', email: 'spence@familypause.com' }
const mockWorkspace = {
  id: 'ws1', name: 'The Longmore Family', invite_code: 'FP-2026-AB12-0001',
  cards_unlocked: true, unlocked_deck_years: [2026], deck_unlocked_at: null,
  family_context: {
    people: ['Spence', 'Amanda', 'Jordan', 'Maya'], kids: ['Jordan', 'Maya'],
    businesses: ['Longmore Studio'], categories: ['Family', 'Kids', 'Business', 'Finance', 'Faith'],
  },
}
const mockKept = [
  { id: 1, person: 'Spence', task: 'Dentist appointment', type: 'event', date: '2026-10-27', time: '09:30', status: 'keep', category: 'Family' },
  { id: 2, person: 'Amanda', task: 'Pick up Maya from practice', type: 'action', date: '2026-10-28', time: '17:00', status: 'keep', category: 'Kids' },
  { id: 3, person: 'Both', task: 'Date night at Olive & Ash', type: 'event', date: '2026-10-30', time: '19:00', status: 'keep', category: 'Family' },
  { id: 4, person: 'Spence', task: 'Send invoice to client', type: 'action', date: null, time: null, status: 'keep', category: 'Business' },
]
const roleOf = (p) => (p === 'Spence' ? 'person1' : p === 'Amanda' ? 'person2' : 'both')
const PAGES = [
  { key: 'plan', label: 'Plan', render: () => <PlanView keptCards={mockKept} adults={['Spence', 'Amanda']} roleOf={roleOf} onRestart={() => {}} onEditReminders={() => {}} meetingDate="2026-10-26" hasFamilyFeatures /> },
  { key: 'landing', label: 'Landing', render: () => <Landing onSignIn={() => {}} onStart={() => {}} /> },
  { key: 'app', label: 'App (5-step flow)', render: () => <App user={mockUser} workspace={mockWorkspace} onSignOut={() => {}} /> },
  { key: 'auth', label: 'Auth', render: () => <Auth onAuthenticated={() => {}} /> },
  { key: 'onboarding', label: 'Onboarding', render: () => <Onboarding workspaceId="ws1" displayName="Sarah" inviteCode="FP-2026-AB12-0001" joined={false} onComplete={() => {}} /> },
  { key: 'cards', label: 'Card System', render: () => <CardSystemRoot workspace={mockWorkspace} onStartSession={() => {}} onClose={() => {}} /> },
  { key: 'settings', label: 'Settings', render: () => <Settings workspace={mockWorkspace} user={mockUser} onSignOut={() => {}} onClose={() => {}} onOpenDecks={() => {}} /> },
  { key: 'paywall', label: 'Paywall', render: () => <Paywall reason="trial" onClose={() => {}} /> },
]

export default function Preview() {
  const [page, setPage] = useState(() => new URLSearchParams(window.location.search).get('page') || 'app')
  const current = PAGES.find((p) => p.key === page)
  return (
    <HelmetProvider>
      <BrowserRouter>
        <div>
          <div style={{
            position: 'sticky', top: 0, zIndex: 9999, display: 'flex', gap: 6, flexWrap: 'wrap',
            alignItems: 'center', padding: '8px 14px', background: '#0F172A',
            fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11, letterSpacing: '0.08em',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.45)', marginRight: 8 }}>Preview</span>
            {PAGES.map((p) => (
              <button key={p.key} onClick={() => setPage(p.key)} style={{
                cursor: 'pointer', border: 'none', borderRadius: 5, padding: '6px 12px',
                fontFamily: 'inherit', fontSize: 11, letterSpacing: '0.06em', background: page === p.key ? '#14805E' : 'rgba(255,255,255,0.10)',
                color: page === p.key ? '#fff' : 'rgba(255,255,255,0.65)',
              }}>{p.label}</button>
            ))}
          </div>
          <div key={page}>{current.render()}</div>
        </div>
      </BrowserRouter>
    </HelmetProvider>
  )
}
