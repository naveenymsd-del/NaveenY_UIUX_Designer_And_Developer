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
import './styles/companion.css'
import './styles/buttons.css'
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'

// The classic portfolio (/mindspace) is the front door: the site's plain address opens it, and
// its "Explore the 3D Portfolio" button leads to the city (/street, /projects). Each is its own
// bundle — the 3D city is never mounted alongside the classic portfolio.
const path = window.location.pathname
const isCity = /\/(street|projects)\/?$/.test(path)
const isMindspace = !isCity
// the plain address shows /mindspace in the bar, so a refresh or a shared link lands in the same place
if (isMindspace && !/\/mindspace\/?$/.test(path)) window.history.replaceState(null, '', `${import.meta.env.BASE_URL}mindspace${window.location.search}${window.location.hash}`)
const Mindspace = lazy(() => import('./mindspace/MindspaceApp'))
const City = lazy(() => import('./app/App').then((m) => ({ default: m.App })))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{isMindspace ? <Mindspace /> : <City />}</Suspense>
  </StrictMode>,
)
