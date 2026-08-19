/**
 * The pace slider, defined once and used twice.
 *
 * It appears in the left-hand panels, where a coach setting a system up meets
 * it alongside the camera, and again inside the video dialog — which is where
 * the complaint that produced it was made, and so where a coach who feels the
 * film dragging will go looking. Two copies of a control that writes the same
 * document field is two chances for the labels, the bounds and the arithmetic
 * to drift apart, so there is one.
 *
 * It edits the document rather than holding a value of its own. That is what
 * makes the two instances agree without talking to each other, and it is why
 * the dialog's quoted running time is right the moment the slider moves: the
 * length is derived from the same field, by the same function, in both places.
 */

import { PACE } from './guide'
import { Slider } from './ui'
import { HOLD_STEP_MS, MAX_HOLD_MS, MIN_HOLD_MS, holdMs } from '../pace'
import { totalDuration } from '../tween'
import type { System } from '../schema'

export function PaceField({
  system,
  onChange,
  onCommit,
}: {
  system: System
  /** Milliseconds. The caller decides how it reaches the document. */
  onChange: (ms: number) => void
  /** The drag has landed — close the undo entry. */
  onCommit?: () => void
}) {
  const hold = holdMs(system)
  const film = totalDuration(system.acts.length, hold) / 1000

  return (
    <div>
      <Slider
        label={PACE.label}
        value={hold}
        min={MIN_HOLD_MS}
        max={MAX_HOLD_MS}
        step={HOLD_STEP_MS}
        onChange={onChange}
        onCommit={onCommit}
        readout={`${(hold / 1000).toFixed(1)}s`}
      />
      <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-ink-faint">
        <span>{PACE.quicker}</span>
        <span>{PACE.slower}</span>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-ink-faint">
        {PACE.line(hold / 1000, film, system.acts.length)}
      </p>
      {hold <= MIN_HOLD_MS && <p className="mt-1 text-[11px] leading-snug text-ink-faint">{PACE.floor}</p>}
    </div>
  )
}
