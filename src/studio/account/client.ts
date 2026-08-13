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
 * env is absent. That is wrong here. Deploy previews do not carry production
 * env, and the studio is deliberately usable with no account at all — a coach's
 * work lives in their own localStorage first (see ../storage.ts). A missing key
 * must cost the sign-in button and nothing else, so this exports `null` and
 * every caller is written to expect it.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.PUBLIC_SUPABASE_URL
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

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
