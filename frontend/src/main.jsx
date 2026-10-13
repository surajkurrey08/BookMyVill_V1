import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { restoreSession } from './lib/session'
import { installImageFallback } from './utils/imageFallback'
import villaPlaceholder from './assets/home/hero-villa.webp'

// Bring back a remembered login before any page reads sessionStorage.
restoreSession()
// Missing uploaded photos fall back to a stock villa image instead of a broken icon.
installImageFallback(villaPlaceholder)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
