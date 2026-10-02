import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { load } from './lib/storage'

// Тему ставим до первого кадра, чтобы не мигало светлым.
const theme = load<string>('duo.theme', 'system')
if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
