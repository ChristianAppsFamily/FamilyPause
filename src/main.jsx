import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import './styles/tokens.css'
import './styles/screens.css'
import Landing from './components/Landing.jsx'
import AppRouter from './AppRouter.jsx'

// Marketing landing at "/". Its CTAs route into the auth + app flow at /app.
function LandingRoute() {
  const navigate = useNavigate()
  return <Landing onSignIn={() => navigate('/app')} onStart={() => navigate('/app')} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/app/*" element={<AppRouter />} />
        {/* Invite links: familypause.com/join/<code>, AppRouter reads the code from the URL */}
        <Route path="/join/*" element={<AppRouter />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
