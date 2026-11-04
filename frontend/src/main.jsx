import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import { AvisosApp } from './components/layout/AvisosApp'
import { AppRouter } from './routes/AppRouter'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppRouter />
      <AvisosApp />
    </BrowserRouter>
  </StrictMode>,
)
