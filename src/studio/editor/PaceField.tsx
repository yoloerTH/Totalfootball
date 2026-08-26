/**
 * The pace controls, defined once and used twice.
 *
 * They appear in the left-hand panels, where a coach setting a system up meets
 * them alongside the camera, and again inside the video dialog — which is where
 * the complaints that produced them were made, and so where a coach who feels
 * the film dragging will go looking. Two copies of a control that writes the
 * same document fields is two chances for the labels, the bounds and the
 * arithmetic to drift apart, so there is one.
 *
 * It edits the document rather than holding values of its own. That is what
 * makes the two instances agree without talking to each other, and it is why
 * the dialog's quoted running time is right the moment either slider moves: the
 * length is derived from the same fields, by the same function, in both places.
 *
 * WHY THE RUNNING TIME IS ONE SENTENCE UNDER BOTH, AND NOT ONE UNDER EACH
 *
 * Because it is a function of both, and a coach reading "4 phases run 12.7s"
 * beneath the hold slider would reasonably assume the hold is what produced it.
 * The two sliders each say what they are worth locally; the pair says what the
 * film is.
 */

import { PACE } from './guide'
import { Slider } from './ui'
import {
  HOLD_STEP_MS,
  MAX_HOLD_MS,
  MAX_MOVE_MS,
  MIN_HOLD_MS,
  MIN_MOVE_MS,
  MOVE_STEP_MS,
  holdMs,
  moveMs,
} from '../pace'
import { totalDuration } from '../tween'
import type { System } from '../schema'

/** The ends of a slider, named in the coach's terms rather than in numbers. */
function Ends() {
  return (
    <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-ink-faint">
      <span>{PACE.quicker}</span>
      <span>{PACE.slower}</span>
    </div>
  )
}

function Footnote({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">{children}</p>
}

export function PaceField({
  system,
  onHold,
  onMove,
  onCommit,
}: {
  system: System
  /** Milliseconds. The caller decides how it reaches the document. */
  onHold: (ms: number) => void
  /** Milliseconds. Slowing this also relaxes the curve — see ../pace.ts. */
  onMove: (ms: number) => void
  /** The drag has landed — close the undo entry. */
  onCommit?: () => void
}) {
  const hold = holdMs(system)
  const move = moveMs(system)
  const film = totalDuration(system.acts.length, hold, move) / 1000

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Slider
          label={PACE.label}
          value={hold}
          min={MIN_HOLD_MS}
          max={MAX_HOLD_MS}
          step={HOLD_STEP_MS}
          onChange={onHold}
          onCommit={onCommit}
          readout={`${(hold / 1000).toFixed(1)}s`}
        />
        <Ends />
        {hold <= MIN_HOLD_MS && <Footnote>{PACE.floor}</Footnote>}
      </div>

      <div>
        <Slider
          label={PACE.moveLabel}
          value={move}
          min={MIN_MOVE_MS}
          max={MAX_MOVE_MS}
          step={MOVE_STEP_MS}
          onChange={onMove}
          onCommit={onCommit}
          readout={`${(move / 1000).toFixed(1)}s`}
        />
        <Ends />
        {/*
         * The slider does two things — it stretches the clock AND relaxes the
         * easing — so it says which one it is doing. At the floor that is
         * nothing, and the note explains why the floor is where it is instead
         * of pretending the control is broken.
         */}
        <Footnote>{move <= MIN_MOVE_MS ? PACE.moveFloor : PACE.moveEven}</Footnote>
      </div>

      <p className="text-[11px] leading-snug text-ink-faint">
        {PACE.line(hold / 1000, move / 1000, film, system.acts.length)}
      </p>
    </div>
  )
}
