import { useCallback, useEffect, useState } from 'react'
import { BOARD } from '../board/palette'
import { DEFAULT_US } from '../schema'
import { UPGRADES_WALKTHROUGH } from './guide'
import { Button } from './ui'

const US = DEFAULT_US.base

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
  gear: (
    <>
      <MiniPitch x={20} y={14} w={280} h={132} />
      
      <image href="/studio/gear/marker-cone.png" x={70} y={50} width={20} height={20} />
      <image href="/studio/gear/marker-cone.png" x={110} y={50} width={20} height={20} />
      <image href="/studio/gear/marker-cone.png" x={150} y={50} width={20} height={20} />
      
      <image href="/studio/gear/dummy-mannequin.png" x={85} y={80} width={24} height={36} />
      <image href="/studio/gear/dummy-mannequin.png" x={125} y={80} width={24} height={36} />
      
      <image href="/studio/gear/ladder.png" x={200} y={30} width={24} height={80} />
    </>
  ),

  names: (
    <>
      <MiniPitch x={60} y={20} w={200} h={100} />
      
      <text x={85} y={45} textAnchor="middle" fontSize={9} fontWeight={800} fill={BOARD.ink}>
        KVARATSKHELIA
      </text>
      <g transform="translate(75, 52)">
        <circle cx={10} cy={10} r={12} fill={US} />
        <clipPath id="clipKvara">
          <circle cx={10} cy={10} r={11} />
        </clipPath>
        <image href="/studio/people/kvaratskhelia-transparent.png" x={-2} y={-2} width={24} height={24} clipPath="url(#clipKvara)" preserveAspectRatio="xMidYMid slice" />
      </g>
      
      <text x={160} y={45} textAnchor="middle" fontSize={9} fontWeight={800} fill={BOARD.ink}>
        MARQUINHOS
      </text>
      <g transform="translate(150, 52)">
        <circle cx={10} cy={10} r={12} fill={US} />
        <clipPath id="clipMarq">
          <circle cx={10} cy={10} r={11} />
        </clipPath>
        <image href="/studio/people/marquinhos-transparent.png" x={-2} y={-2} width={24} height={24} clipPath="url(#clipMarq)" preserveAspectRatio="xMidYMid slice" />
      </g>

      <text x={235} y={45} textAnchor="middle" fontSize={9} fontWeight={800} fill={BOARD.ink}>
        VITINHA
      </text>
      <g transform="translate(225, 52)">
        <circle cx={10} cy={10} r={12} fill={US} />
        <clipPath id="clipVit">
          <circle cx={10} cy={10} r={11} />
        </clipPath>
        <image href="/studio/people/vitinha.png" x={-2} y={-2} width={24} height={24} clipPath="url(#clipVit)" preserveAspectRatio="xMidYMid slice" />
      </g>
    </>
  ),

  profile: (
    <>
      <rect x={80} y={30} width={160} height={100} rx={8} fill={BOARD.paper2} stroke={BOARD.line} />
      <circle cx={120} cy={60} r={16} fill={US} />
      <rect x={150} y={50} width={60} height={6} rx={3} fill={BOARD.ink} opacity={0.8} />
      <rect x={150} y={64} width={40} height={4} rx={2} fill={BOARD.ink} opacity={0.4} />
      
      <rect x={100} y={90} width={120} height={20} rx={4} fill={BOARD.gold} />
      <text x={160} y={103} textAnchor="middle" fontSize={8} fontWeight={800} fill="#161618">
        EDIT PROFILE
      </text>
    </>
  ),

  ask: (
    <>
      {/* Search box */}
      <rect x={100} y={30} width={120} height={30} rx={6} fill={BOARD.paper2} stroke={BOARD.line} strokeWidth={1.5} />
      <text x={160} y={49} textAnchor="middle" fontSize={11} fontWeight={600} fill={BOARD.ink}>
        how do i add cones?
      </text>

      {/* A ring highlighting a UI element below it */}
      <rect x={145} y={85} width={30} height={30} rx={4} fill={BOARD.paper2} stroke={BOARD.line} />
      <image href="/studio/gear/traffic-cone.png" x={152} y={90} width={16} height={20} />
      <circle cx={160} cy={100} r={22} fill="none" stroke={BOARD.goldDeep} strokeWidth={2.4} strokeDasharray="4 4" />
    </>
  ),
}

interface Props {
  /** Called with `true` when they finished it, `false` when they skipped. */
  onClose: (finished: boolean) => void
}

export function UpgradesWalkthrough({ onClose }: Props) {
  const [i, setI] = useState(0)
  const step = UPGRADES_WALKTHROUGH[i]
  const last = i === UPGRADES_WALKTHROUGH.length - 1

  const next = useCallback(() => {
    if (last) onClose(true)
    else setI((n) => n + 1)
  }, [last, onClose])

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
      className="fixed inset-0 z-[80] flex justify-center overflow-y-auto overscroll-contain bg-ink/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="What's new in the studio"
    >
      <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-ink-hair bg-surface shadow-lift">
        <div style={{ background: BOARD.paper }}>
          <svg viewBox="0 0 320 160" className="block h-auto w-full" role="presentation">
            {ART[step.id]}
          </svg>
        </div>

        <div className="px-6 pb-5 pt-5">
          <p className="mb-1 text-micro uppercase text-ink-faint">
            Update {i + 1} of {UPGRADES_WALKTHROUGH.length}
          </p>
          <h2 className="mb-3 text-xl font-black tracking-display text-ink">{step.title}</h2>
          {step.body.map((p) => (
            <p key={p} className="mb-2.5 text-sm leading-relaxed text-ink-soft">
              {p}
            </p>
          ))}

          {step.id === 'profile' && (
            <div className="mt-4 mb-2">
              <a
                href="/studio/settings"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center justify-center rounded-md bg-gold px-4 text-sm font-black text-[#161618] hover:bg-gold-deep"
              >
                Go to Settings
              </a>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <div className="flex flex-1 items-center gap-1.5">
              {UPGRADES_WALKTHROUGH.map((s, n) => (
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
              {last ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
