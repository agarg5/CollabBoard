import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const useStrictMode = import.meta.env.VITE_DISABLE_STRICT_MODE !== 'true'

createRoot(document.getElementById('root')!).render(
  useStrictMode ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  ),
)
