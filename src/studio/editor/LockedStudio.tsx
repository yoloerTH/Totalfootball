/**
 * One of ours, opened inside the real studio by somebody who is only looking.
 *
 * Mounted by src/pages/o/[slug].astro, and it is deliberately almost nothing:
 * the page has already decided WHICH system, at build time, and hands the whole
 * document over as a prop. There is no fetch, no `/api/share` row, no id to
 * resolve and nothing that can 404 — the document is part of the page, because
 * on these two URLs the document IS the page.
 *
 * ── WHY THE DOCUMENT ARRIVES AS A PROP ───────────────────────────────────────
 *
 * The obvious alternative is to hand this the slug and let it read ../templates
 * for itself. That module carries all seven documents, and the two official ones
 * are 35KB and 27KB of JSON on their own — see the note at the top of
 * ./StudioMount.tsx, which imports it lazily for exactly this reason. A page
 * about ONE system would be paying to ship six others.
 *
 * Astro inlines the prop instead, so `/o/escaping-the-trap` carries that
 * system's document and no other, and it arrives with the HTML rather than as a
 * second request after React has booted.
 *
 * ── WHY THERE IS NO ID WORTH SPEAKING OF ─────────────────────────────────────
 *
 * `systemId` still has to be passed, because the editor takes one — but nothing
 * on a locked board reads it. Autosave is off, the account sync is off, and both
 * are off precisely so that this id never reaches this browser's shelf. It is
 * the template's id, which makes it legible in a debugger and useless anywhere
 * else. See the `locked` note in ./StudioEditor.tsx.
 */

import StudioEditor from './StudioEditor'
import type { System } from '../schema'

export default function LockedStudio({ id, system }: { id: string; system: System }) {
  return <StudioEditor systemId={id} initial={system} locked />
}
