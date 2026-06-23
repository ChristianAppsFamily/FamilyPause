import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import './styles/tokens.css'
import './styles/screens.css'
import Landing from './components/Landing.jsx'
import AppRouter from './AppRouter.jsx'
import ResetPassword from './components/ResetPassword.jsx'
import CardsProductPage from './components/CardsProductPage.jsx'

// Marketing landing at "/". Its CTAs route into the auth + app flow at /app.
function LandingRoute() {
  const navigate = useNavigate()
  return (
    <Landing
      onSignIn={() => navigate('/app', { replace: true })}
      onStart={() => navigate('/app?signup=1', { replace: true })}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/cards" element={<CardsProductPage />} />
        <Route path="/app/*" element={<AppRouter />} />
        <Route path="/join/*" element={<AppRouter />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
