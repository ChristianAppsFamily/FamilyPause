import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { goToSignIn, goToSignUp } from './lib/routes.js'
import { HelmetProvider } from 'react-helmet-async'
import './styles/tokens.css'
import './styles/screens.css'
import Landing from './components/Landing.jsx'
import AppRouter from './AppRouter.jsx'
import ResetPassword from './components/ResetPassword.jsx'
import CardsProductPage from './components/CardsProductPage.jsx'
import BlogIndex from './components/BlogIndex.jsx'
import BlogPost from './components/BlogPost.jsx'
import Contact from './components/Contact.jsx'
import Mobile from './components/Mobile.jsx'
import { SubscribeSuccess, SubscribeCancel } from './components/SubscribePages.jsx'
import { AnalyticsRouteListener } from './lib/analytics.js'

// Marketing landing at "/". Its CTAs route into the auth + app flow at /app.
function LandingRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <Landing
      onSignIn={() => goToSignIn(navigate, location)}
      onStart={() => goToSignUp(navigate, location)}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <AnalyticsRouteListener />
        <Routes>
          <Route path="/" element={<LandingRoute />} />
          <Route path="/cards" element={<CardsProductPage />} />
          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/mobile" element={<Mobile />} />
          <Route path="/subscribe/success" element={<SubscribeSuccess />} />
          <Route path="/subscribe/cancel" element={<SubscribeCancel />} />
          <Route path="/app/*" element={<AppRouter />} />
          <Route path="/join/*" element={<AppRouter />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
)

document.body.classList.add("fp-hydrated")
document.getElementById("fp-static-fallback")?.setAttribute("hidden", "")

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
