import { defineConfig } from 'astro/config'
import react from '@astrojs/react'

/**
 * The canonical origin. Deliberately env-driven, never hardcoded: the site
 * launches on a subdomain of naurra.ai but is expected to move to its own
 * domain later, and that should be a config change plus a 301 map — not a
 * find-and-replace across the codebase. See docs/SPEC.md §1.
 */
const SITE = process.env.PUBLIC_SITE_URL || 'https://totalfootball.naurra.ai'

export default defineConfig({
  integrations: [react()],
  output: 'static',
  site: SITE,
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  vite: {
    envPrefix: ['PUBLIC_'],
  },
})
