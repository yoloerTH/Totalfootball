/**
 * "Put my name on it." The same switch in all three export dialogs.
 *
 * ── WHY IT IS ITS OWN COMPONENT AND NOT THREE `<Toggle>`s ────────────────────
 *
 * Because it is one promise, and a promise that is worded three ways is three
 * promises. What this switch takes off a file is listed in `withoutIdentity`
 * (../schema.ts) and it is wider than a credit line — the crest goes, and so do
 * the players' names. A coach turning it off in the share dialog and finding
 * their squad still named on an exported picture would be right to call that
 * broken, so the control that sets it says the same sentence everywhere.
 *
 * ── AND WHY THE DEFAULT COMES FROM THE PROFILE ───────────────────────────────
 *
 * A coach who never wants their name on anything should say so once, on the
 * settings page, and then never think about it again. A coach who wants it off
 * for THIS one board should be able to do that without a trip to settings and
 * back, and without changing what the next export does. Those are two different
 * wants and this is the shape that serves both: the account holds the default,
 * this switch holds the exception, and the exception lasts as long as the
 * board is open.
 */

import { IDENTITY } from './guide'
import { Toggle } from './ui'

export function IdentityToggle({
  on,
  onChange,
  /** What goes out: 'this picture', 'this film', 'the link'. */
  what,
  /** Whether the state shown is the account default rather than a choice. */
  fromDefault = false,
}: {
  on: boolean
  onChange: (next: boolean) => void
  what: string
  fromDefault?: boolean
}) {
  return (
    <div>
      <Toggle checked={on} onChange={onChange} label={IDENTITY.label} />
      <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">
        {on ? IDENTITY.on : IDENTITY.off(what)}
        {fromDefault && <span className="text-ink-faint"> {IDENTITY.fromSettings}</span>}
      </p>
    </div>
  )
}
