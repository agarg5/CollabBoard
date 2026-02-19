import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

const useStrictMode = import.meta.env.VITE_DISABLE_STRICT_MODE !== 'true'

createRoot(document.getElementById('root')!).render(
  useStrictMode ? (
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  ) : (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  ),
)
