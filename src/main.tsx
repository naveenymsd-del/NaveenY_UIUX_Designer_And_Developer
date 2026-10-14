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
import './styles/brand.css'
import './styles/welcome.css'
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'

// /mindspace is a separate experience (the spatial portfolio): its own bundle,
// and the 3D city is never mounted alongside it
const isMindspace = /\/mindspace\/?$/.test(window.location.pathname)
const Mindspace = lazy(() => import('./mindspace/MindspaceApp'))
const City = lazy(() => import('./app/App').then((m) => ({ default: m.App })))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{isMindspace ? <Mindspace /> : <City />}</Suspense>
  </StrictMode>,
)
