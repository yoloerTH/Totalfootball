/**
 * The welcome walkthrough — five screens, shown once.
 *
 * Deliberately NOT a spotlight tour that points at controls one by one. A tour
 * teaches where things are, and where things are is the part a coach can find
 * by looking. What they cannot find by looking is the idea the whole studio is
 * built on: that you pose the same board twice and the movement between the two
 * poses is the film. So this teaches the IDEA, in five screens, and then gets
 * out of the way and lets the tooltips and the step-by-step rail teach the
 * controls in context, at the moment each one is needed.
 *
 * The drawings matter more than the words here. "A phase is a moment, not a
 * slide" is abstract until you have seen two boards side by side with the same
 * counter in two places and a dotted line between them.
 *
 * Every illustration is inline SVG on the paper stage, in the board's own
 * colours, so the guide looks like the thing it is explaining.
 */

import { useCallback, useEffect, useState } from 'react'
import { ARROW_STYLE, BOARD } from '../board/palette'
import { DEFAULT_THEM, DEFAULT_US } from '../schema'
import { WALKTHROUGH } from './guide'
import { Button } from './ui'

const US = DEFAULT_US.base
const THEM = DEFAULT_THEM.base

/** A counter, at illustration scale. Not the real Token — this is a diagram. */
function Dot({ x, y, fill = US, r = 7 }: { x: number; y: number; fill?: string; r?: number }) {
  return (
    <>
      <circle cx={x} cy={y + 1.5} r={r} fill="#141A16" opacity={0.16} />
      <circle cx={x} cy={y} r={r} fill={fill} stroke="#FFFFFF" strokeWidth={1.4} />
    </>
  )
}

/** A miniature pitch, sized to whatever box the illustration puts it in. */
function MiniPitch({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g stroke={BOARD.line} strokeWidth={1.1} fill="none">
      <rect x={x} y={y} width={w} height={h} rx={2} fill={BOARD.paper2} />
      <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} />
      <circle cx={x + w / 2} cy={y + h / 2} r={h * 0.16} />
      <rect x={x} y={y + h * 0.28} width={w * 0.11} height={h * 0.44} />
      <rect x={x + w * 0.89} y={y + h * 0.28} width={w * 0.11} height={h * 0.44} />
    </g>
  )
}

const ART: Record<string, React.ReactNode> = {
  // The board, and a hand moving one counter across it.
  board: (
    <>
      <MiniPitch x={20} y={14} w={280} h={132} />
      <Dot x={58} y={80} />
      <Dot x={104} y={48} />
      <Dot x={104} y={112} />
      <Dot x={168} y={62} />
      <Dot x={168} y={98} />
      <Dot x={232} y={44} fill={THEM} />
      <Dot x={244} y={80} fill={THEM} />
      <Dot x={232} y={116} fill={THEM} />
      <path
        d="M 168 98 C 190 106 200 118 206 128"
        stroke={BOARD.goldDeep}
        strokeWidth={2}
        strokeDasharray="4 4"
        fill="none"
      />
      <Dot x={208} y={130} r={8} />
      <circle cx={208} cy={130} r={13} fill="none" stroke={BOARD.gold} strokeWidth={1.8} />
    </>
  ),

  // The one that matters: same board twice, one player in two places.
  phases: (
    <>
      <MiniPitch x={10} y={26} w={135} h={100} />
      <text x={77} y={18} textAnchor="middle" fontSize={10} fontWeight={900} fill={BOARD.ink}>
        PHASE 1
      </text>
      <Dot x={38} y={76} r={6} />
      <Dot x={72} y={54} r={6} />
      <Dot x={72} y={98} r={6} />
      <Dot x={108} y={76} r={6} fill={BOARD.goldDeep} />

      <path d="M 156 76 L 178 76" stroke={BOARD.ink} strokeWidth={2} opacity={0.35} />
      <path d="M 172 70 L 180 76 L 172 82 Z" fill={BOARD.ink} opacity={0.35} />

      <MiniPitch x={190} y={26} w={135} h={100} />
      <text x={257} y={18} textAnchor="middle" fontSize={10} fontWeight={900} fill={BOARD.ink}>
        PHASE 2
      </text>
      <Dot x={218} y={76} r={6} />
      <Dot x={252} y={54} r={6} />
      <Dot x={252} y={98} r={6} />
      <path
        d="M 288 76 C 296 60 300 50 302 42"
        stroke={BOARD.goldDeep}
        strokeWidth={1.8}
        strokeDasharray="3 3"
        fill="none"
        opacity={0.7}
      />
      <Dot x={288} y={76} r={6} fill={BOARD.goldDeep} />
      <Dot x={303} y={40} r={6} fill={BOARD.goldDeep} />

      <text x={167} y={148} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={BOARD.ink} opacity={0.62}>
        move him, and we work out the rest
      </text>
    </>
  ),

  // Intent, not drawing properties: the five marks, each drawn its own way.
  marks: (
    <>
      <MiniPitch x={20} y={14} w={280} h={124} />
      <Dot x={70} y={76} r={7} />
      <Dot x={186} y={44} r={7} />
      <Dot x={186} y={110} r={7} fill={THEM} />

      {/* The two treatments drawn exactly as ARROW_STYLE draws them, so the
          guide is not teaching a look the board does not actually produce. */}
      <path d="M 80 70 L 172 48" stroke={ARROW_STYLE.pass.color} strokeWidth={2.4} fill="none" />
      <path d="M 166 42 L 178 47 L 165 53 Z" fill={ARROW_STYLE.pass.color} />

      <path
        d="M 80 84 L 170 106"
        stroke={ARROW_STYLE.run.color}
        strokeWidth={2.4}
        strokeDasharray="6 4"
        fill="none"
      />
      <path d="M 165 100 L 177 106 L 164 111 Z" fill={ARROW_STYLE.run.color} />

      <text x={128} y={34} textAnchor="middle" fontSize={9.5} fontWeight={900} fill={ARROW_STYLE.pass.color}>
        PASS
      </text>
      <text x={122} y={128} textAnchor="middle" fontSize={9.5} fontWeight={900} fill={ARROW_STYLE.run.color}>
        RUN
      </text>
    </>
  ),

  // Play: the phase strip with a playhead running through it.
  play: (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={26 + i * 92}
            y={30}
            width={78}
            height={62}
            rx={4}
            fill={BOARD.paper2}
            stroke={i === 1 ? BOARD.gold : BOARD.line}
            strokeWidth={i === 1 ? 2.4 : 1.1}
          />
          <Dot x={48 + i * 92} y={62} r={5} />
          <Dot x={70 + i * 92 + i * 6} y={52} r={5} />
          <Dot x={84 + i * 92} y={74} r={5} fill={THEM} />
          <text x={65 + i * 92} y={106} textAnchor="middle" fontSize={9} fontWeight={800} fill={BOARD.ink} opacity={0.6}>
            {i + 1}
          </text>
        </g>
      ))}
      <rect x={26} y={120} width={262} height={4} rx={2} fill={BOARD.line} opacity={0.35} />
      <rect x={26} y={120} width={132} height={4} rx={2} fill={BOARD.gold} />
      <circle cx={158} cy={122} r={6} fill={BOARD.goldDeep} />
      <path d="M 156 119 L 162 122 L 156 125 Z" fill="#FFFFFF" />
    </>
  ),

  // Saved: a board with a tick, no cloud — it is on their machine, not ours.
  saved: (
    <>
      <MiniPitch x={60} y={20} w={200} h={100} />
      <Dot x={100} y={70} r={6} />
      <Dot x={140} y={50} r={6} />
      <Dot x={140} y={90} r={6} />
      <Dot x={186} y={70} r={6} />
      <circle cx={228} cy={112} r={19} fill={BOARD.greenDeep} />
      <path
        d="M 219 112 L 225 119 L 238 105"
        stroke="#FFFFFF"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <text x={160} y={148} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={BOARD.ink} opacity={0.62}>
        saved on this computer as you type
      </text>
    </>
  ),
}

interface Props {
  /** Called with `true` when they finished it, `false` when they skipped. */
  onClose: (finished: boolean) => void
}

export function Walkthrough({ onClose }: Props) {
  const [i, setI] = useState(0)
  const step = WALKTHROUGH[i]
  const last = i === WALKTHROUGH.length - 1

  const next = useCallback(() => {
    if (last) onClose(true)
    else setI((n) => n + 1)
  }, [last, onClose])

  // Arrows page it, Escape leaves it. A coach who wants to get on with it
  // should not have to find the small grey word in the corner.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false)
      if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [next, onClose])

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How the studio works"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-ink-hair bg-surface shadow-lift">
        {/* the drawing sits on the paper stage, like the board does */}
        <div style={{ background: BOARD.paper }}>
          <svg viewBox="0 0 320 160" className="block h-auto w-full" role="presentation">
            {ART[step.id]}
          </svg>
        </div>

        <div className="px-6 pb-5 pt-5">
          <p className="mb-1 text-micro uppercase text-ink-faint">
            Step {i + 1} of {WALKTHROUGH.length}
          </p>
          <h2 className="mb-3 text-xl font-black tracking-display text-ink">{step.title}</h2>
          {step.body.map((p) => (
            <p key={p} className="mb-2.5 text-sm leading-relaxed text-ink-soft">
              {p}
            </p>
          ))}

          <div className="mt-5 flex items-center gap-3">
            <div className="flex flex-1 items-center gap-1.5">
              {WALKTHROUGH.map((s, n) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Step ${n + 1}: ${s.title}`}
                  onClick={() => setI(n)}
                  className={`h-1.5 rounded-full transition-all ${
                    n === i ? 'w-5 bg-ink' : 'w-1.5 bg-ink-hair hover:bg-ink-faint'
                  }`}
                />
              ))}
            </div>

            {i > 0 && <Button onClick={() => setI((n) => n - 1)}>Back</Button>}
            {!last && <Button onClick={() => onClose(false)}>Skip</Button>}
            <Button variant="solid" onClick={next}>
              {last ? 'Start building' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
