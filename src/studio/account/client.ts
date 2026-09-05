/**
 * The Supabase client the BROWSER holds.
 *
 * This is the posture change docs/STUDIO.md §5 asked for, and it is worth being
 * precise about what changed and what did not. Every other table in this
 * project is reached only through a Netlify function holding the service-role
 * key, and `.env.example` says the keys are "never referenced from a browser
 * bundle". That is still true of THAT key and those tables.
 *
 * Accounts cannot work that way. "Only this coach may read this system" is a
 * statement about who is asking, and a function holding a service-role key has
 * no user to be. So the browser holds the ANON key — which is not a secret, it
 * is a project identifier — and RLS in supabase/005 is the real boundary,
 * enforced by Postgres against the signed-in user in the JWT.
 *
 * ── IT MUST NOT THROW WHEN THE ENV IS MISSING ────────────────────────────────
 *
 * The reference implementation this is modelled on throws at module load if the
 * env is absent. That is wrong here, for two separate reasons:
 *
 *   · Deploy previews do not carry production env. A missing key must cost the
 *     sign-in button and nothing else, so this exports `null` and every caller
 *     is written to expect it.
 *
 *   · `import.meta.env` ITSELF does not exist outside Vite, and this module is
 *     now reachable from plain Node. ../sequences.ts imports `db` at the top
 *     level so the library can be read, and scripts/check-transform.mjs imports
 *     the geometry out of that same file — so a bare `import.meta.env.X` threw
 *     `Cannot read properties of undefined` and took the build's own checks
 *     down with it. The optional chain below is the whole fix and it is not
 *     decorative: any module a check script can reach must survive being loaded
 *     by something that is not a bundler.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const env = import.meta.env as Record<string, string | undefined> | undefined
const url = env?.PUBLIC_SUPABASE_URL
const anonKey = env?.PUBLIC_SUPABASE_ANON_KEY

/**
 * `null` when this build has no Supabase env — see above. Never assume it.
 *
 * Created lazily so that importing this module from a page that never signs
 * anyone in does not open a session, start a refresh timer, or touch storage.
 */
let client: SupabaseClient | null | undefined

export function db(): SupabaseClient | null {
  if (client !== undefined) return client
  client =
    url && anonKey
      ? createClient(url, anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            // The OAuth round trip comes back with the session in the URL hash.
            // Supabase reads it, stores it and cleans the address bar.
            detectSessionInUrl: true,
          },
        })
      : null
  return client
}

/** Whether this build can sign anyone in at all. Drives what the UI offers. */
export const accountsEnabled = Boolean(url && anonKey)
