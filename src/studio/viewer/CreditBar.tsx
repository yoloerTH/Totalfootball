/**
 * The credit bar: their name on the left, ours on the right.
 *
 * This is the watermark, and the shape of it is the policy (docs/STUDIO.md).
 * A corner logo on somebody else's work reads as a tax, and the first thing a
 * coach does with a tax is crop it off. A credit line reads as authorship —
 * their club, their session, presented by them — and nobody crops their own
 * name out of their own presentation. Ours travels along beside it.
 *
 * So it is never drawn without the coach's half filled in, and the coach's half
 * comes first in the source as well as on screen.
 */

import type { Credit } from '../schema'
import { CreditCta } from './BuildCta'
import { Mark } from './Mark'

/** "12 August 2026" — a date a coach reads, not an ISO stamp. */
export function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function CreditBar({
  credit,
  compact = false,
  /**
   * Whether our half is a live invitation or a plain credit.
   *
   * ON SCREEN it is a door: somebody reading a shared system is the person most
   * likely to want one of their own, and a credit nobody knows is clickable
   * converts nobody. See ./BuildCta.tsx.
   *
   * ON PAPER it is a credit and nothing else. A printed sheet cannot be pressed,
   * and "Build your own →" under a coach's team sheet is an advert printed on
   * somebody else's handout. The print stylesheet renders the same component,
   * so this is the switch that keeps the two honest.
   */
  cta = true,
}: {
  credit?: Credit
  compact?: boolean
  cta?: boolean
}) {
  const presenter = credit?.presenter?.trim()
  const team = credit?.team?.trim()
  const note = credit?.note?.trim()
  const date = formatDate(credit?.sharedOn)

  // Left-hand side, in the order it reads: who, for whom, when.
  const theirs = [presenter, team].filter(Boolean).join(' · ')
  const under = [note, date].filter(Boolean).join(' · ')

  return (
    <div
      className={`flex items-center justify-between gap-4 border-t border-ink-hair ${
        compact ? 'px-4 py-2' : 'px-5 py-3'
      }`}
    >
      <div className="min-w-0">
        {theirs ? (
          <p className="truncate text-[12px] font-bold leading-tight text-ink">{theirs}</p>
        ) : (
          <p className="truncate text-[12px] font-bold leading-tight text-ink-faint">A tactical system</p>
        )}
        {under && <p className="truncate text-[11px] leading-tight text-ink-faint">{under}</p>}
      </div>

      {cta ? (
        <CreditCta compact={compact} />
      ) : (
        <span className="flex shrink-0 items-center gap-2 text-ink-soft">
          <span className="text-right text-[10px] font-bold uppercase leading-tight tracking-micro">
            Made with
            <br />
            Total Football
          </span>
          <Mark size={compact ? 22 : 28} />
        </span>
      )}
    </div>
  )
}
