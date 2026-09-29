// GitHub Pages has no rewrites: serving index.html as 404.html lets deep links
// such as /street and /projects load the app (the router reads the path).
import { copyFileSync, writeFileSync } from 'node:fs'
copyFileSync('dist/index.html', 'dist/404.html')
writeFileSync('dist/.nojekyll', '')
console.log('spa fallback: dist/404.html written')
