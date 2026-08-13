/// <reference types="astro/client" />

/**
 * The env vars this site reads, declared so a typo is a build error rather than
 * a silent `undefined` that only shows up as a broken sign-in on production.
 *
 * Only PUBLIC_ vars belong here. Everything else is read by the Netlify
 * functions from `process.env`, server-side, and must never be typed into a
 * browser bundle's view of the world — see .env.example.
 */
interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string
  /** The accounts client. Absent on a preview with no env: accounts go quiet. */
  readonly PUBLIC_SUPABASE_URL?: string
  readonly PUBLIC_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /**
   * First-party analytics, exposed by src/components/Analytics.astro.
   *
   * Optional on purpose: the studio's islands render inside pages that always
   * include Analytics, but they also render under `astro dev` with the script
   * blocked, in a print preview, and in whatever a coach's browser extension
   * decides to remove. Every caller has to cope with it being missing, and the
   * type says so rather than leaving it to be discovered.
   *
   * It records a LABEL and nothing else, and it is already silent when the
   * visitor has opted out or signalled Do Not Track — see that file.
   */
  tfTrack?: (label: string) => void
  /** The footer's opt-out control. Same file. */
  tfPrivacy?: {
    optOut: () => boolean
    optIn: () => boolean
    isOptedOut: () => boolean
    enabled: boolean
  }
}
