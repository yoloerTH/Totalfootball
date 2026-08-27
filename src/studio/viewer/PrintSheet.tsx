/**
 * Every phase, one per page: the PDF export.
 *
 * ── THERE IS NO PDF LIBRARY, AND THAT IS THE DESIGN ─────────────────────────
 *
 * The whole system is already in the document as live SVG, hidden on screen by
 * `.tf-print`. Printing hands that to the browser, which lays it out one phase
 * per page and writes a PDF with the boards as VECTOR and the type as
 * really-Inter. Rasterising through a canvas would have meant solving the
 * font-embedding problem in docs/STUDIO.md §6 — inlining a subset Inter as
 * base64, silently falling back to Helvetica whenever we got it wrong — and
 * would have produced a worse PDF at the end of it.
 *
 * It is built as real DOM rather than generated on demand for one reason worth
 * keeping: the thing that prints is the thing that was on screen. There is no
 * export path with its own bugs, no fonts to embed, no ball to inline — the
 * browser already has all of it loaded.
 *
 * ── WHY IT LIVES HERE AND NOT INSIDE THE VIEWER ─────────────────────────────
 *
 * It was a private function in ./Viewer.tsx, which meant the PDF existed only
 * for somebody who had been SENT a link — a coach working on their own system
 * in the studio had to publish it, open their own link and print that (user,
 * 2026-08-27). The sheet was never viewer-specific; it is a function of a
 * `System` and nothing else. Moved out whole so both mount the same one and
 * there is still exactly one thing that prints.
 *
 * The print stylesheet it depends on is in src/styles/global.css, for the same
 * reason: it used to be scoped to the /studio/watch/ page.
 */

import { Board } from '../board/Board'
import { PITCH_VIEWS, aspect, resolveViewId } from '../board/pitch'
import { resolveAct } from '../tween'
import type { System } from '../schema'
import { CreditBar, formatDate } from './CreditBar'
import { Mark } from './Mark'

export function PrintSheet({ system }: { system: System }) {
  const view = PITCH_VIEWS[resolveViewId(system.pitch)]
  const credit = system.credit

  return (
    <div className="tf-print" aria-hidden="true">
      {/* cover */}
      <section className="tf-slide tf-cover">
        <div className="tf-cover-mid">
          <Mark size={54} ink="#161618" />
          <h1 className="tf-cover-title">{system.title || 'A tactical system'}</h1>
          {system.subtitle && <p className="tf-cover-sub">{system.subtitle}</p>}
          <p className="tf-cover-meta">
            {[credit?.presenter, credit?.team].filter(Boolean).join(' · ')}
            {credit?.note ? ` · ${credit.note}` : ''}
          </p>
          <p className="tf-cover-date">{formatDate(credit?.sharedOn)}</p>
        </div>
        <p className="tf-cover-foot">
          {system.acts.length} {system.acts.length === 1 ? 'phase' : 'phases'} · Made with Total Football
        </p>
      </section>

      {system.acts.map((a, i) => (
        <section key={a.id} className="tf-slide">
          <header className="tf-slide-head">
            <span className="tf-slide-n">
              {i + 1} / {system.acts.length}
            </span>
            <h2 className="tf-slide-title">{a.title || `Phase ${i + 1}`}</h2>
          </header>

          <div className="tf-slide-board" style={{ aspectRatio: aspect(view) }}>
            <Board system={system} act={resolveAct(a, system)} idp={`print-${a.id}`} />
          </div>

          {a.caption && <p className="tf-slide-caption">{a.caption}</p>}
          {a.notes && <p className="tf-slide-notes">{a.notes}</p>}

          <div className="tf-slide-credit">
            <CreditBar credit={credit} compact cta={false} />
          </div>
        </section>
      ))}
    </div>
  )
}
