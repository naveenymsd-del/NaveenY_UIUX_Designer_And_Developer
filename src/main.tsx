import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '@fontsource-variable/instrument-sans'
import '@fontsource/open-sauce-sans/latin-500.css'
import '@fontsource/open-sauce-sans/latin-600.css'
import './styles/global.css'
import './styles/ui.css'
import './styles/refine.css'
import './styles/case.css'
import './styles/voice.css'
import './styles/splash.css'
import './styles/rain.css'
import './styles/layers.css'
import './styles/project-case.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
