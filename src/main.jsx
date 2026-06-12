import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AnimatedBackground from './components/AnimatedBackground.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AnimatedBackground />
    <App />
  </StrictMode>,
)
