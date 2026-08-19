/**
 * The studio.
 *
 * One React island, entirely client-side, because the site builds static (see
 * astro.config.mjs `output: 'static'`) and because the editing loop — pick up a
 * counter, move it, put it down — has to be immediate. Nothing here round-trips
 * to a server; ../storage.ts writes to localStorage on every change and the
 * Supabase sync will sit behind that as a write-through cache.
 *
 * The constraint that shapes this file: a coach is not a designer. Every
 * control either picks football (a shape, a view, an intent) or picks identity
 * (their colours, their crest). None of them picks drawing properties. Dash
 * patterns, opacities, easing and z-order are decided in ../board and are not
 * exposed, which is the only reason a board built here still looks like ours.
 *
 * The second constraint, and the reason this file carries a whole guidance
 * layer: the people this is for are coaches in their fifties, not people who
 * use editors. The tool being capable is not the same as the tool being usable
 * by them. So every control has a hint written in their language (./guide.ts),
 * the mental model gets taught once on arrival (./Walkthrough.tsx), and the
 * order to do things in is on screen until it is not needed (./GuideRail.tsx).
 * An "Act" is a "phase" everywhere a coach can read it — see PHASE in
 * ./guide.ts for why the code does not rename the type.
 *
 * THE THREE THINGS THAT ARE EASY TO GET WRONG IN HERE:
 *
 *  · Every document change goes through `edit()` or `patchAct()`, both of which
 *    take a LABEL. The label is what groups a drag into one undo (./history.ts).
 *    A `setSystem` that skips them is a change a coach cannot take back.
 *  · Selection is one of two things at a time, never both: a player, or a mark.
 *    `select*` helpers enforce it so Delete never has to guess.
 *  · The layout exists twice — beside the board on a wide screen, stacked under
 *    it on a narrow one. The panels themselves are built ONCE, into variables,
 *    and composed differently. Do not fork them.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Board, clampToBoard, clientToPercent } from '../board/Board'
import { PITCH_VIEWS, PITCH_VIEW_LIST, aspect, remap, resolveViewId, toMetres } from '../board/pitch'
import type { PitchView } from '../board/pitch'
import { readableText, darken } from '../board/palette'
import {
  PITCH_SURFACES,
  DEFAULT_SURFACE,
  arrowStyle,
  bandStyle,
  resolveSurface,
  type PitchSurfaceId,
} from '../board/surfaces'
import { BALLS, DEFAULT_BALL, resolveBall, type BallId } from '../balls'
import {
  CAMERA_MODES,
  frameMetres,
  resolveCamera,
  viewMetres,
  type CameraMode,
} from '../camera'
import {
  FORMATION_BY_ID,
  castFor,
  formationsByFamily,
  place,
  relabel,
  type LabelMode,
} from '../formations'
import {
  CENTRE_SPOT,
  DEFAULT_THEM,
  DEFAULT_US,
  emptyAct,
  uid,
  type Act,
  type Arrow,
  type ArrowKind,
  type Band,
  type BandKind,
  type Credit,
  type Cue,
  type Side,
  type System,
  type Token,
} from '../schema'
import { resolveAct, timelineAt, totalDuration, tweenActs } from '../tween'
import { readGuide, saveSystem, writeGuide, type GuideState } from '../storage'
import { useCloudSync } from '../account/sync'
import { GuideRail } from './GuideRail'
import {
  ARROW_TOOL_IDS,
  HINT,
  PHASE,
  RAIL_STEPS,
  TOOL_DOC,
  ZONE_TOOL_IDS,
  type RailStep,
  type ToolId,
} from './guide'
import { useHistory } from './history'
import { ShareDialog } from './ShareDialog'
import { SmallScreen, isSmallScreen } from './SmallScreen'
import { ThemeToggle } from './ThemeToggle'
import { VideoDialog } from './VideoDialog'
import { Tip } from './Tip'
import { Walkthrough } from './Walkthrough'
import {
  Button,
  ColorWell,
  ConfirmButton,
  Field,
  Panel,
  PicturePicker,
  Segmented,
  Select,
  SurfacePicker,
  TextArea,
  TextInput,
  Toggle,
} from './ui'

const CUES: Cue[] = ['PRESS', 'COVER', 'BALANCE', 'SPARE', 'JOCKEY', 'DROP']

/**
 * What the pointer does on the board. `select` moves and picks things up;
 * everything else is drawn by dragging, and reverts to `select` when it lands —
 * a coach draws one pass and then wants to move somebody, not draw nine passes.
 */
type Tool = ToolId

const isArrowTool = (t: Tool): t is ArrowKind => (ARROW_TOOL_IDS as readonly string[]).includes(t)
const isZoneTool = (t: Tool): t is 'danger' | 'zone' => (ZONE_TOOL_IDS as readonly string[]).includes(t)

/**
 * What is selected. One thing at a time and never two kinds at once, so Delete
 * and the inspector both have exactly one question to answer.
 */
type Selection = { kind: 'token'; id: string } | { kind: 'mark'; id: string } | null

/** Which side a band belongs to, read back off the players it runs through. */
function bandSide(band: Band, act: Act): Side {
  return act.tokens.find((t) => t.id === band.throughTokens?.[0])?.side ?? 'us'
}

/**
 * Carry a coach's per-player editing across a re-place.
 *
 * Re-placing a formation resets POSITIONS, which is the point of it. It must
 * not also throw away the label they retyped, the name they added, the cue they
 * assigned or the fade they set — those are the parts they had to think about.
 * Matched by token id, which is stable by construction (see ../schema.ts).
 */
function withEdits(placed: Token[], previous: Token[]): Token[] {
  const prev = new Map(previous.map((t) => [t.id, t]))
  return placed.map((t) => {
    const p = prev.get(t.id)
    return p ? { ...t, label: p.label, name: p.name, cue: p.cue, dim: p.dim } : t
  })
}

/**
 * The deepest line of a side, worked out from where the players actually are.
 *
 * "Add block" used to take the four deepest outfielders, full stop, which is
 * right for a back four and wrong for every other shape we ship — a back three
 * got a fourth player dragged into its line, and a back five lost a wing-back.
 * Grouping by the GAP between players instead reads the line off the board:
 * defenders standing level are one line, and the space in front of them is
 * where the line ends. Three, four and five all come out correct, and so does a
 * back four that the coach has already dragged out of shape.
 *
 * Depth is measured in METRES, not in percent. Percent is percent-of-crop, so a
 * seven-metre gap is 7% of a full pitch and 23% of the box view, and a
 * percentage threshold would find a different line depending on how far the
 * camera happened to be pushed in.
 */
const LINE_GAP_M = 7
const LINE_MAX = 5

function backLine(tokens: Token[], side: Side, view: PitchView): Token[] {
  const outfield = tokens.filter((t) => t.side === side && !t.id.endsWith('-GK'))
  if (outfield.length < 2) return []

  // Distance from the goal this side is defending, in metres up the pitch.
  const depth = (t: Token) => {
    const m = toMetres(view, t.x, t.y).x
    return side === 'us' ? m : 105 - m
  }

  const sorted = [...outfield].sort((a, b) => depth(a) - depth(b))
  const line = [sorted[0]]
  for (let i = 1; i < sorted.length && line.length < LINE_MAX; i++) {
    if (depth(sorted[i]) - depth(sorted[i - 1]) > LINE_GAP_M) break
    line.push(sorted[i])
  }
  // Two players is the fewest that make a line worth shading. If the deepest
  // player is standing on their own, take the next one anyway rather than
  // refusing to do anything, which reads as a broken button.
  const chosen = line.length >= 2 ? line : sorted.slice(0, 2)
  return [...chosen].sort((a, b) => a.y - b.y)
}

/** Live media query. Drives the layout only; the small-screen door is separate. */
function useMediaQuery(query: string): boolean {
  // Read synchronously on first render. The studio is `client:only`, so there
  // is no server pass to mismatch against, and starting at `false` would build
  // the wide layout and then throw it away on a phone.
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}

interface Props {
  systemId: string
  initial: System
}

export default function StudioEditor({ systemId, initial }: Props) {
  const [actIndex, setActIndex] = useState(0)
  const [selection, setSelection] = useState<Selection>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [dragging, setDragging] = useState<{ kind: 'token'; id: string } | { kind: 'ball' } | null>(null)
  const [pending, setPending] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null)
  const [playhead, setPlayhead] = useState<number | null>(null)
  const [labels, setLabels] = useState<LabelMode>('position')
  const [usFormation, setUsFormation] = useState('4-3-3')
  const [themFormation, setThemFormation] = useState('4-4-2')
  const [panelTab, setPanelTab] = useState<'setup' | 'phase'>('setup')

  // The phase on screen travels with an undo entry: taking back a change made
  // on phase 3 has to put you back on phase 3 to be worth anything.
  const actIndexRef = useRef(actIndex)
  actIndexRef.current = actIndex
  const getMeta = useCallback(() => ({ actIndex: actIndexRef.current }), [])
  const history = useHistory<System, { actIndex: number }>(initial, getMeta)
  const system = history.value
  const { edit, seal, replace } = history

  // ── what the coach has been taught ─────────────────────────────────────────
  const [guide, setGuide] = useState<GuideState>(() => readGuide())
  const [walkthrough, setWalkthrough] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [makingVideo, setMakingVideo] = useState(false)
  // Evaluated once, on mount: a desktop coach narrowing their window should not
  // have an interstitial thrown over their work. See ./SmallScreen.tsx.
  const [tooSmall, setTooSmall] = useState(false)

  // A ref alongside the state so `markGuide` can compare against the current
  // value without taking it as a dependency — it is called from pointer
  // handlers that must not be rebuilt on every flag change.
  const guideRef = useRef(guide)
  guideRef.current = guide

  const markGuide = useCallback((patch: Partial<GuideState>) => {
    const cur = guideRef.current
    const changed = (Object.keys(patch) as (keyof GuideState)[]).some((k) => cur[k] !== patch[k])
    if (changed) setGuide(writeGuide(patch))
  }, [])

  useEffect(() => {
    if (isSmallScreen() && !guideRef.current.smallOk) setTooSmall(true)
    else if (!guideRef.current.seen) setWalkthrough(true)
  }, [])

  const svgRef = useRef<SVGSVGElement | null>(null)
  const view = PITCH_VIEWS[resolveViewId(system.pitch)]
  const act = system.acts[Math.min(actIndex, system.acts.length - 1)]
  const stacked = useMediaQuery('(max-width: 1023px)')

  // Autosave. Debounced so a drag writes once when it settles rather than on
  // every pointermove, which would serialise the whole document 60 times a
  // second for no benefit.
  useEffect(() => {
    const t = setTimeout(() => saveSystem(systemId, system), 400)
    return () => clearTimeout(t)
  }, [systemId, system])

  // And behind that, the account — if there is one. Local is authoritative and
  // this never blocks it; see ../account/sync.ts.
  const cloud = useCloudSync(systemId, system)

  // Deleting the last phase, or undoing back past one, can leave the index
  // pointing at nothing. Render already clamps; this keeps the state honest so
  // the strip highlights the phase actually on screen.
  useEffect(() => {
    if (actIndex > system.acts.length - 1) setActIndex(Math.max(0, system.acts.length - 1))
  }, [actIndex, system.acts.length])

  /**
   * Latch the guide steps that are readable off the document.
   *
   * Doing it here rather than at each call site means a coach who returns to a
   * system they built last week is not told to add a second phase — the rail
   * catches up with the document the moment it opens.
   */
  useEffect(() => {
    const patch: Partial<GuideState> = {}
    if (system.title.trim()) patch.named = true
    if (system.acts.length >= 2) patch.phased = true
    if (system.acts.some((a) => a.arrows.length > 0)) patch.drew = true
    if (Object.keys(patch).length) markGuide(patch)
  }, [system, markGuide])

  /** Every mutation goes through here, so autosave and undo have one seam. */
  const patchAct = useCallback(
    (label: string, fn: (a: Act) => Act) => {
      edit(label, (s) => ({
        ...s,
        acts: s.acts.map((a, i) => (i === Math.min(actIndexRef.current, s.acts.length - 1) ? fn(a) : a)),
      }))
    },
    [edit],
  )

  // ── selection ──────────────────────────────────────────────────────────────
  const selectedToken = selection?.kind === 'token' ? (act?.tokens.find((t) => t.id === selection.id) ?? null) : null
  const selectedMarkId = selection?.kind === 'mark' ? selection.id : null
  const selectedArrow = selectedMarkId ? (act?.arrows.find((a) => a.id === selectedMarkId) ?? null) : null
  const selectedBand = selectedMarkId ? (act?.bands.find((b) => b.id === selectedMarkId) ?? null) : null

  /** Take the selected thing off this phase. Returns whether there was one. */
  const deleteSelection = useCallback((): boolean => {
    if (!selection) return false
    const { kind, id } = selection
    patchAct('delete', (a) =>
      kind === 'token'
        ? { ...a, tokens: a.tokens.filter((t) => t.id !== id) }
        : { ...a, arrows: a.arrows.filter((x) => x.id !== id), bands: a.bands.filter((b) => b.id !== id) },
    )
    seal()
    setSelection(null)
    return true
  }, [selection, patchAct, seal])

  // ── undo ───────────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    const meta = history.undo()
    if (!meta) return
    setActIndex(meta.actIndex)
    setSelection(null)
    setPlayhead(null)
  }, [history])

  const redo = useCallback(() => {
    const meta = history.redo()
    if (!meta) return
    setActIndex(meta.actIndex)
    setSelection(null)
    setPlayhead(null)
  }, [history])

  // ── phases ─────────────────────────────────────────────────────────────────
  /**
   * Move the view to another phase. NOT an edit — nothing about the document
   * changes, which is exactly the distinction the footer's two pairs of arrows
   * were failing to make. Navigation steps between moments; reordering changes
   * the order they happen in.
   */
  const goToPhase = useCallback(
    (i: number) => {
      setActIndex((cur) => {
        const next = Math.min(Math.max(0, i), system.acts.length - 1)
        if (next !== cur) {
          setSelection(null)
          setPlayhead(null)
        }
        return next
      })
    },
    [system.acts.length],
  )

  // ── keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      const mod = e.metaKey || e.ctrlKey

      // Typing wins, including the shortcuts. Cmd+Z in the title field has to
      // take back the last letter, not the last thing that happened on the
      // board — a coach fixing a typo does not expect their shape to revert.
      if (typing) return

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (mod) return

      if (e.key === 'Escape') {
        setTool('select')
        setPending(null)
        setSelection(null)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (deleteSelection()) e.preventDefault()
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPhase(actIndexRef.current - 1)
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToPhase(actIndexRef.current + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, deleteSelection, goToPhase])

  // ── gestures on the board ──────────────────────────────────────────────────
  /*
   * A gesture binds its own listeners, in the handler, at the moment the
   * pointer goes down. It used to be bound from an effect keyed on the
   * gesture's state, and that lost fast gestures outright: `setDragging`
   * schedules a render, the effect only runs once React has committed it, and
   * every pointermove delivered in between is dropped. A flick — press, a few
   * moves and a release, all arriving in one task, which is exactly how a
   * quick drag lands — moved the counter ZERO pixels. Measured in a browser,
   * not reasoned about.
   *
   * `setPointerCapture` on the <svg> is the other half. Without it a release
   * outside the window is never delivered: the drag stays live, and the next
   * click anywhere in the studio is spent dropping a counter that has been
   * following the cursor ever since.
   *
   * The capture goes on the <svg> rather than on the counter because the <svg>
   * is the node that is certain to still be there when the pointer comes up —
   * a counter can be re-keyed by a phase change mid-gesture.
   *
   * `end` is kept in a ref so unmounting mid-drag cannot leak the listeners.
   */
  const endGesture = useRef<(() => void) | null>(null)
  useEffect(() => () => endGesture.current?.(), [])

  const bindGesture = useCallback(
    (
      pointerId: number,
      onMove: (e: PointerEvent) => void,
      onEnd: () => void,
    ) => {
      const svg = svgRef.current
      // Safari on an old iPad throws rather than no-ops. Capture is an
      // improvement to the gesture, not a requirement of it.
      try {
        svg?.setPointerCapture(pointerId)
      } catch {
        /* no capture; the window listeners still carry the gesture */
      }
      const move = (e: PointerEvent) => {
        if (e.pointerId === pointerId) onMove(e)
      }
      const finish = () => {
        endGesture.current = null
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        try {
          svg?.releasePointerCapture(pointerId)
        } catch {
          /* already released with the capture that was never taken */
        }
        onEnd()
      }
      const up = (e: PointerEvent) => {
        if (e.pointerId === pointerId) finish()
      }
      endGesture.current = finish
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    },
    [],
  )

  const beginDrag = useCallback(
    (drag: { kind: 'token'; id: string } | { kind: 'ball' }, e: React.PointerEvent) => {
      const svg = svgRef.current
      if (!svg) return
      e.stopPropagation()
      // Without this the browser starts a text selection on the way down, and
      // then paints it across the pitch for the rest of the drag.
      e.preventDefault()
      setDragging(drag)

      bindGesture(
        e.pointerId,
        (ev) => {
          const raw = clientToPercent(svg, view, ev.clientX, ev.clientY)
          const p = clampToBoard(raw.x, raw.y)
          // One label for the whole gesture: ../history.ts collapses it into a
          // single undo entry, and `seal()` on release closes it so the next
          // drag of the same counter is its own.
          patchAct(`drag:${drag.kind === 'ball' ? 'ball' : drag.id}`, (a) =>
            drag.kind === 'ball'
              ? { ...a, ball: p }
              : { ...a, tokens: a.tokens.map((t) => (t.id === drag.id ? { ...t, ...p } : t)) },
          )
        },
        () => {
          if (drag.kind === 'token') markGuide({ moved: true })
          seal()
          setDragging(null)
        },
      )
    },
    [bindGesture, view, patchAct, markGuide, seal],
  )

  /*
   * Arrows and shaded areas are the same gesture: press, drag, release. They
   * differ only in what gets committed, so they share one handler rather than
   * two that drift apart.
   */
  const beginDraw = useCallback(
    (e: React.PointerEvent) => {
      const svg = svgRef.current
      if (!svg) return
      e.preventDefault()
      const from = clientToPercent(svg, view, e.clientX, e.clientY)
      // Held here as well as in state: the commit at the end reads these
      // locals, so it cannot land on a stale render's copy of the drag.
      let to = from
      setPending({ from, to })

      bindGesture(
        e.pointerId,
        (ev) => {
          to = clientToPercent(svg, view, ev.clientX, ev.clientY)
          setPending({ from, to })
        },
        () => {
          if (isArrowTool(tool)) {
            // A click that did not travel is a misclick, not a zero-length arrow.
            if (Math.hypot(to.x - from.x, to.y - from.y) > 3) {
              patchAct('arrow', (a) => ({
                ...a,
                arrows: [...a.arrows, { id: uid('ar'), kind: tool, from, to }],
              }))
              seal()
            }
          } else if (isZoneTool(tool)) {
            // A sliver of a box is a misdrag. Both sides have to be real.
            if (Math.abs(to.x - from.x) > 4 && Math.abs(to.y - from.y) > 4) {
              patchAct('zone', (a) => ({
                ...a,
                bands: [...a.bands, { id: uid('bd'), kind: tool, rect: rectOf(from, to) }],
              }))
              seal()
            }
          }
          setPending(null)
          setTool('select')
        },
      )
    },
    [bindGesture, view, tool, patchAct, seal],
  )

  // ── playback ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (playhead === null) return
    let raf = 0
    const start = performance.now() - playhead
    const total = totalDuration(system.acts.length)
    const step = () => {
      const t = performance.now() - start
      if (t >= total) {
        setPlayhead(null)
        setActIndex(system.acts.length - 1)
        return
      }
      setPlayhead(t)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // Restarting on every playhead tick would reset `start`; the ref-free
    // approach here is to depend only on whether playback is on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playhead === null, system.acts.length])

  const timeline = playhead === null ? null : timelineAt(playhead, system.acts.length)
  const rendered = useMemo(() => {
    if (timeline) {
      return tweenActs(system.acts[timeline.index], system.acts[timeline.next], timeline.p, system)
    }
    const base = resolveAct(act, system)
    if (!pending) return base
    // Preview the mark being drawn, without committing it to the document.
    if (isArrowTool(tool)) {
      return {
        ...base,
        arrows: [
          ...base.arrows,
          { id: 'preview', kind: tool, from: pending.from, to: pending.to, opacity: 0.6 },
        ],
      }
    }
    if (isZoneTool(tool)) {
      return {
        ...base,
        bands: [...base.bands, { id: 'preview', kind: tool, rect: rectOf(pending.from, pending.to) }],
      }
    }
    return base
    // On the WHOLE system, not on `system.acts`.
    //
    // The narrow list was right while a pose was only ever a function of the
    // acts. It stopped being right the moment the camera arrived: the shot is
    // derived from `system.camera` and `system.pitch`, and flipping the camera
    // makes a new system object while leaving the acts array — and `act` — at
    // the same reference, so nothing here changed and the board went on
    // drawing the previous frame. Naming the two fields would fix today's bug
    // and leave the same trap set for the next render-affecting field, so this
    // depends on the document. The cost is re-posing 22 counters when a title
    // is typed, which is nothing.
  }, [timeline, system, act, pending, tool])

  const playing = playhead !== null
  const drawing = tool !== 'select'

  // ── team + shape actions ───────────────────────────────────────────────────
  const applyFormation = (side: Side, formationId: string) => {
    const f = FORMATION_BY_ID.get(formationId)
    if (!f) return
    const placed = place(f, side, system.pitch, labels, side === 'us' && !system.teams.them)
    patchAct('formation', (a) => ({ ...a, tokens: [...a.tokens.filter((t) => t.side !== side), ...placed] }))
    seal()
    if (side === 'us') setUsFormation(formationId)
    else setThemFormation(formationId)
  }

  /**
   * Change the pitch view without destroying anything.
   *
   * Percent coordinates are relative to the crop, so they cannot simply be
   * carried over — but they can be re-expressed. Every mark goes out to metres
   * in the old view and back into percent in the new one, which keeps it on the
   * same patch of grass. Players who fall outside the new crop stay in the
   * document and reappear when it widens; `Re-place shapes` is there for when
   * the coach actually wants the shape fitted to the view they are now on.
   *
   * The earlier version of this re-placed both formations and deleted every
   * arrow in every act, which is a lot of a coach's work to throw away for a
   * change they might be making to take a second look.
   */
  const setPitch = (pitch: System['pitch']) => {
    edit('pitch', (s) => {
      const from = PITCH_VIEWS[resolveViewId(s.pitch)]
      const to = PITCH_VIEWS[resolveViewId(pitch)]
      const rp = (p: { x: number; y: number }) => remap(from, to, p.x, p.y)
      return {
        ...s,
        pitch,
        acts: s.acts.map((a) => ({
          ...a,
          tokens: a.tokens.map((t) => ({ ...t, ...rp(t) })),
          ball: a.ball ? rp(a.ball) : null,
          arrows: a.arrows.map((ar) => ({ ...ar, from: rp(ar.from), to: rp(ar.to) })),
          bands: a.bands.map((b) => {
            if (!b.rect) return b
            const tl = rp({ x: b.rect.x, y: b.rect.y })
            const br = rp({ x: b.rect.x + b.rect.w, y: b.rect.y + b.rect.h })
            return { ...b, rect: { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y } }
          }),
        })),
      }
    })
    seal()
  }

  /** Snap both shapes back to their formation defaults, fitted to this view. */
  const replaceShapes = () => {
    const us = FORMATION_BY_ID.get(usFormation)
    const them = FORMATION_BY_ID.get(themFormation)
    const solo = !system.teams.them
    patchAct('replace', (a) => ({
      ...a,
      tokens: [
        ...(us ? withEdits(place(us, 'us', system.pitch, labels, solo), a.tokens) : []),
        ...(system.teams.them && them ? withEdits(place(them, 'them', system.pitch, labels), a.tokens) : []),
      ],
    }))
    seal()
  }

  const toggleOpposition = (on: boolean) => {
    edit('opposition', (s) => {
      const us = FORMATION_BY_ID.get(usFormation)
      const them = FORMATION_BY_ID.get(themFormation)
      return {
        ...s,
        teams: { ...s.teams, them: on ? (s.teams.them ?? DEFAULT_THEM) : null },
        // Our shape is re-placed either way: it holds most of the board when
        // alone and half of it when there is an opposition to face, so the
        // width has to be handed over as the toggle flips.
        acts: s.acts.map((a) => ({
          ...a,
          tokens: [
            ...(us ? withEdits(place(us, 'us', s.pitch, labels, !on), a.tokens) : []),
            ...(on && them ? withEdits(place(them, 'them', s.pitch, labels), a.tokens) : []),
          ],
        })),
      }
    })
    seal()
  }

  const setTeamColor = (side: Side, base: string) => {
    edit(`colour:${side}`, (s) => ({
      ...s,
      teams: {
        ...s.teams,
        [side]: {
          ...(side === 'us' ? s.teams.us : (s.teams.them ?? DEFAULT_THEM)),
          base,
          deep: darken(base),
          text: readableText(base),
        },
      },
    }))
  }

  const applyLabels = (mode: LabelMode) => {
    setLabels(mode)
    edit('labels', (s) => ({
      ...s,
      acts: s.acts.map((a) => ({
        ...a,
        tokens: [
          ...relabel(a.tokens.filter((t) => t.side === 'us'), usFormation, mode),
          ...relabel(a.tokens.filter((t) => t.side === 'them'), themFormation, mode),
        ],
      })),
    }))
    seal()
  }

  /**
   * One more counter, for a twelfth man or a shape that is not eleven a side.
   *
   * The id is checked against EVERY act, not just this one. A token id is the
   * identity that makes tweening work (see ../schema.ts), so reusing an id that
   * exists in another act would quietly weld the new counter to a player who
   * was removed from this one — and they would fly across the board on Play.
   */
  const addPlayer = (side: Side) => {
    edit('add-player', (s) => {
      const taken = new Set(s.acts.flatMap((a) => a.tokens.map((t) => t.id)))
      let n = 1
      while (taken.has(`${side}-X${n}`)) n++
      const id = `${side}-X${n}`
      return {
        ...s,
        acts: s.acts.map((a, i) =>
          i === actIndex
            ? { ...a, tokens: [...a.tokens, { id, x: 50, y: 50, label: String(n), side }] }
            : a,
        ),
      }
    })
    seal()
  }

  /**
   * Empty the whole thing and start again.
   *
   * Undoable like everything else, which is what lets the button be a button
   * rather than a modal with a warning triangle on it. The editor state that is
   * not in the document — which shape the pickers are showing, which tool is
   * armed — has to be put back by hand, or the panels would describe a board
   * that is no longer there.
   */
  const startOver = () => {
    edit('reset', () => newSystem())
    seal()
    setActIndex(0)
    setSelection(null)
    setTool('select')
    setPending(null)
    setPlayhead(null)
    setUsFormation('4-3-3')
    setThemFormation('4-4-2')
    setLabels('position')
  }

  /**
   * Open the share dialog, stamping the date the link was made.
   *
   * The date is set here rather than at encode time so it is part of the
   * document a coach can see and the autosave keeps — a link remade tomorrow
   * says tomorrow, which is what the credit line is claiming.
   */
  const openShare = () => {
    edit('share', (s) => ({
      ...s,
      credit: { ...s.credit, sharedOn: s.credit?.sharedOn ?? new Date().toISOString() },
    }))
    seal()
    setSharing(true)
  }

  const patchCredit = (patch: Partial<Credit>) => {
    edit('credit', (s) => ({ ...s, credit: { ...s.credit, ...patch } }))
  }

  /**
   * Keep the id the server published under.
   *
   * `replace`, not `edit`: this is the server telling us where the document
   * now lives, not something the coach did, and it has no business sitting in
   * their undo stack between two things they actually changed.
   */
  const rememberShareId = useCallback(
    (shareId: string) => replace((s) => (s.shareId === shareId ? s : { ...s, shareId })),
    [replace],
  )

  // ── act actions ────────────────────────────────────────────────────────────
  const addAct = () => {
    // A new act starts as a COPY of the current one. That is the whole authoring
    // model: you do not build a new board, you move the one you have, and the
    // difference between the two becomes the animation.
    edit('add-phase', (s) => {
      const src = s.acts[Math.min(actIndex, s.acts.length - 1)]
      const copy: Act = {
        ...structuredClone(src),
        id: uid('act'),
        title: `${PHASE.One} ${s.acts.length + 1}`,
      }
      const acts = [...s.acts]
      acts.splice(actIndex + 1, 0, copy)
      return { ...s, acts }
    })
    seal()
    setActIndex((i) => i + 1)
    setSelection(null)
  }

  const deleteAct = () => {
    if (system.acts.length <= 1) return
    edit('delete-phase', (s) => ({ ...s, acts: s.acts.filter((_, i) => i !== actIndex) }))
    seal()
    setActIndex((i) => Math.max(0, i - 1))
    setSelection(null)
  }

  /** Reorder: this phase changes places with its neighbour. */
  const moveAct = (dir: -1 | 1) => {
    const to = actIndex + dir
    if (to < 0 || to >= system.acts.length) return
    edit('reorder', (s) => {
      const acts = [...s.acts]
      const [a] = acts.splice(actIndex, 1)
      acts.splice(to, 0, a)
      return { ...s, acts }
    })
    seal()
    setActIndex(to)
  }

  // ── selection editing ──────────────────────────────────────────────────────
  const patchToken = (patch: Partial<Token>, label: string) => {
    if (!selectedToken) return
    const id = selectedToken.id
    patchAct(`token:${label}`, (a) => ({
      ...a,
      tokens: a.tokens.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }

  const patchMark = (patch: Partial<Arrow>) => {
    if (!selectedMarkId) return
    patchAct('mark', (a) => ({
      ...a,
      arrows: a.arrows.map((x) => (x.id === selectedMarkId ? { ...x, ...patch } : x)),
    }))
  }

  /**
   * Shade the space a side's deepest line is protecting.
   *
   * One block per side, replaced rather than stacked: two overlapping blocks for
   * the same back four is never what anybody meant, and the second one would
   * hide the first.
   */
  const addBlockBand = (side: Side) => {
    const line = backLine(act.tokens, side, view)
    if (line.length < 2) return
    patchAct('block', (a) => ({
      ...a,
      bands: [
        ...a.bands.filter((b) => !(b.kind === 'block' && bandSide(b, a) === side)),
        { id: uid('bd'), kind: 'block' as BandKind, throughTokens: line.map((t) => t.id) },
      ],
    }))
    seal()
  }

  const blockFor = (side: Side) => act?.bands.find((b) => b.kind === 'block' && bandSide(b, act) === side)
  const usIsBlank = Boolean(FORMATION_BY_ID.get(usFormation)?.blank)
  const ball = resolveBall(system.matchBall)
  const surface = resolveSurface(system.surface)
  const camera = resolveCamera(system.camera)
  const cameraMode = CAMERA_MODES.find((c) => c.id === camera) ?? CAMERA_MODES[0]
  // Read out in metres of grass rather than as a zoom factor — see ../camera.ts.
  const frameWide = frameMetres(view, rendered.shot)
  const viewWide = viewMetres(view)
  const formationGroups = useMemo(
    () =>
      formationsByFamily().map((g) => ({
        label: g.family,
        options: g.formations.map((f) => ({ value: f.id, label: f.name })),
      })),
    [],
  )

  /**
   * How many of each side this view will actually place, and whether that is
   * fewer than eleven.
   *
   * Said out loud under the pitch picker, because a coach who presses Re-place
   * shapes on "their box" and gets six players needs to know that was the tool
   * fitting the shape to the crop, not the tool losing five of their players.
   */
  const cast = useMemo(() => {
    const f = FORMATION_BY_ID.get(usFormation)
    const t = FORMATION_BY_ID.get(themFormation)
    const us = f ? castFor(f, 'us', system.pitch).length : 11
    const them = t ? castFor(t, 'them', system.pitch).length : 11
    const partial = (f ? us < f.slots.length : false) || (system.teams.them && t ? them < t.slots.length : false)
    return { us, them, partial }
  }, [usFormation, themFormation, system.pitch, system.teams.them])

  const railDone = useMemo(
    () =>
      RAIL_STEPS.reduce(
        (acc, s) => {
          acc[s.id] = guide[s.id]
          return acc
        },
        {} as Record<RailStep['id'], boolean>,
      ),
    [guide],
  )

  /**
   * Players who are in the document but not on screen.
   *
   * Changing to a tighter view is deliberately non-destructive — everyone stays
   * on the patch of grass the coach put them on, and those outside the new crop
   * reappear when it widens (see `setPitch`). Correct, and completely baffling
   * from the outside: pick "Their box" from a full-pitch 4-3-3 and ten players
   * silently vanish. So say it, and say what to do about it.
   */
  const offCrop = act ? act.tokens.filter((t) => t.x < -2 || t.x > 102 || t.y < -2 || t.y > 102).length : 0

  if (!act) return null

  if (tooSmall) {
    return (
      <SmallScreen
        onContinue={() => {
          markGuide({ smallOk: true })
          setTooSmall(false)
          if (!guideRef.current.seen) setWalkthrough(true)
        }}
      />
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // The pieces. Built once, arranged twice — see the note at the top of the
  // file. Anything that reads differently between the two layouts is a bug.
  // ────────────────────────────────────────────────────────────────────────────

  const toolbar = (
    <header className="flex shrink-0 items-center gap-2 border-b border-ink-hair bg-surface px-3 py-2.5 lg:gap-3 lg:px-4">
      <div className="min-w-0 flex-1">
        <Tip text={HINT.title} title="Name of this system" side="bottom">
          <input
            value={system.title}
            onChange={(e) => edit('title', (s) => ({ ...s, title: e.target.value }))}
            placeholder="Name your system…"
            aria-label="Name of this system"
            className="w-full max-w-sm bg-transparent text-sm font-black tracking-display text-ink outline-none placeholder:text-ink-faint"
          />
        </Tip>
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-lg bg-paper p-1">
        <Tip text={HINT.undo} title="Undo" side="bottom">
          <Button onClick={undo} disabled={!history.canUndo} className="!px-2" aria-label="Undo">
            <Arc dir="left" />
          </Button>
        </Tip>
        <Tip text={HINT.redo} title="Redo" side="bottom">
          <Button onClick={redo} disabled={!history.canRedo} className="!px-2" aria-label="Redo">
            <Arc dir="right" />
          </Button>
        </Tip>
      </div>

      {/* The mark vocabulary. Scrolls rather than wraps on a narrow screen, so
          the board never gets pushed off the bottom by a second row. */}
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg bg-paper p-1">
        {(['select', ...ARROW_TOOL_IDS] as Tool[]).map((id) => (
          <Tip key={id} text={<ToolText id={id} />} title={TOOL_DOC[id].label} side="bottom">
            <Button active={tool === id} onClick={() => setTool(id)} className="!px-2 lg:!px-2.5">
              {TOOL_DOC[id].label}
            </Button>
          </Tip>
        ))}
      </div>

      <Tip text={playing ? HINT.stop : HINT.play} title={playing ? 'Stop' : 'Play'} side="bottom">
        <Button
          variant="solid"
          onClick={() => {
            if (!playing) markGuide({ played: true })
            setPlayhead(playing ? null : 0)
          }}
          disabled={system.acts.length < 2}
        >
          {playing ? 'Stop' : 'Play'}
        </Button>
      </Tip>

      <Tip text={HINT.share} title="Share" side="bottom">
        <Button onClick={openShare}>Share</Button>
      </Tip>

      <Tip text={HINT.video} title="Video" side="bottom">
        <Button onClick={() => setMakingVideo(true)}>Video</Button>
      </Tip>

      {/*
       * Only ever says that the work HAS landed. A coach cannot act on "could
       * not reach the server", their work is already safe on this machine
       * either way, and a warning they cannot do anything about mid-drag is
       * just noise — see ../account/sync.ts.
       */}
      {(cloud === 'saving' || cloud === 'saved') && (
        <span className="hidden shrink-0 text-[11px] font-bold text-ink-faint lg:inline">
          {cloud === 'saving' ? 'Saving…' : 'Saved'}
        </span>
      )}

      <ThemeToggle />

      <Tip text={HINT.help} title="Guide" side="bottom">
        <Button onClick={() => setWalkthrough(true)} className="!px-2" aria-label="Reopen the guide">
          ?
        </Button>
      </Tip>
    </header>
  )

  const boardStage = (
    <div
      className="min-h-0 max-h-full max-w-full overflow-hidden rounded-xl shadow-lift"
      style={{ aspectRatio: aspect(view), height: '100%' }}
    >
      <Board
        svgRef={svgRef}
        system={system}
        act={rendered}
        idp="studio"
        /* Wide while posing with the shot outlined on top; the real push-in
           happens on Play. See `showFrame` in ../board/Board.tsx. */
        showFrame={!playing}
        activeTokenId={dragging && dragging.kind === 'token' ? dragging.id : (selectedToken?.id ?? null)}
        activeMarkId={selectedMarkId}
        onTokenPointerDown={
          playing || drawing
            ? undefined
            : (id, e) => {
                setSelection({ kind: 'token', id })
                beginDrag({ kind: 'token', id }, e)
              }
        }
        /* Marks are only pickable with the Move tool: a drawing tool has to be
           able to start a new mark on top of one that is already there. */
        onArrowPointerDown={
          playing || drawing
            ? undefined
            : (id, e) => {
                e.stopPropagation()
                setSelection({ kind: 'mark', id })
              }
        }
        onBandPointerDown={
          playing || drawing
            ? undefined
            : (id, e) => {
                e.stopPropagation()
                setSelection({ kind: 'mark', id })
              }
        }
        onBallPointerDown={
          playing || drawing
            ? undefined
            : (e) => {
                setSelection(null)
                beginDrag({ kind: 'ball' }, e)
              }
        }
        onBackgroundPointerDown={(e) => {
          if (playing) return
          if (!drawing) {
            setSelection(null)
            // Pressing the grass is a deselect, never the start of a text
            // selection dragged across the board.
            e.preventDefault()
            return
          }
          beginDraw(e)
        }}
      />
    </div>
  )

  /*
   * The line under the board. This is the highest-value piece of guidance in
   * the studio, because it is the only one in the place a coach is already
   * looking. It says what to do next, in context: how to use the tool they just
   * picked, what they have selected, or that one phase does not animate and why.
   */
  const boardLine = (
    <p className="shrink-0 px-3 text-center text-[11px] leading-snug text-ink-faint">
      {drawing ? (
        <>
          <span className="font-bold text-ink">{TOOL_DOC[tool].drag}</span> {TOOL_DOC[tool].when}
        </>
      ) : playing ? (
        <>
          Playing all {system.acts.length} {PHASE.many}.
        </>
      ) : selectedArrow || selectedBand ? (
        <>
          <span className="font-bold text-ink">{markName(selectedArrow ?? selectedBand!, act)} selected.</span> Bend it
          or delete it on the right, or press Delete on your keyboard.
        </>
      ) : offCrop > 0 ? (
        <>
          <span className="font-bold text-ink">
            {offCrop} {offCrop === 1 ? 'player is' : 'players are'} outside this view.
          </span>{' '}
          They are still in your system: widen the pitch view to see them again, or press Re-place shapes to fit
          everyone inside it.
        </>
      ) : system.acts.length < 2 ? (
        <>
          <span className="font-bold text-ink-soft">
            {PHASE.One} {actIndex + 1} of {system.acts.length}.
          </span>{' '}
          One {PHASE.one} is a still picture. Add a second below and move someone, and it becomes a move.
        </>
      ) : (
        <>
          <span className="font-bold text-ink-soft">
            {PHASE.One} {actIndex + 1} of {system.acts.length}
            {act.title ? `: ${act.title}` : ''}.
          </span>{' '}
          Move the players to where they finish, then press Play.
        </>
      )}
    </p>
  )

  /*
   * The phase strip: navigation on the left of it, reordering on the right.
   *
   * These two used to be one pair of arrows that reordered, and every coach who
   * met them read them as "next phase" — reasonably, since they sit under a row
   * of thumbnails. They are now separated by the strip itself, the navigation
   * pair is unlabelled chevrons where a carousel would put them, and the
   * reordering pair says the word "Move".
   */
  const phaseStrip = (
    <footer className="flex shrink-0 select-none items-center gap-2 border-t border-ink-hair bg-surface px-2 py-2 lg:gap-3 lg:px-4 lg:py-3">
      <Tip text={HINT.prevPhase} title={`Previous ${PHASE.one}`} side="top">
        <Button
          onClick={() => goToPhase(actIndex - 1)}
          disabled={actIndex === 0}
          className="!px-2"
          aria-label={`Go to the previous ${PHASE.one}`}
        >
          <Chevron dir="left" />
        </Button>
      </Tip>

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {system.acts.map((a, i) => (
          <button
            key={a.id}
            type="button"
            onClick={() => goToPhase(i)}
            className={`group relative shrink-0 overflow-hidden rounded-md border-2 bg-paper transition ${
              i === (timeline?.index ?? actIndex) ? 'border-gold' : 'border-ink-hair hover:border-ink-faint'
            }`}
            style={{ width: stacked ? 72 : 96, aspectRatio: aspect(view) }}
            title={`${PHASE.One} ${i + 1}${a.title ? `: ${a.title}` : ''}`}
          >
            {/* No system, so no camera: a thumbnail is for finding a phase by
                its shape, which a push-in would crop away. */}
            <Board system={system} act={resolveAct(a)} idp={`thumb-${a.id}`} />
            <span className="absolute bottom-0 left-0 right-0 bg-ink/75 px-1 py-0.5 text-[10px] font-bold text-paper">
              {i + 1}. {a.title}
            </span>
          </button>
        ))}
        <Tip text={HINT.addPhase} title={`Add ${PHASE.one}`} side="top">
          <Button onClick={addAct} variant={system.acts.length < 2 ? 'solid' : 'ghost'}>
            + Add {PHASE.one}
          </Button>
        </Tip>
      </div>

      <Tip text={HINT.nextPhase} title={`Next ${PHASE.one}`} side="top">
        <Button
          onClick={() => goToPhase(actIndex + 1)}
          disabled={actIndex >= system.acts.length - 1}
          className="!px-2"
          aria-label={`Go to the next ${PHASE.one}`}
        >
          <Chevron dir="right" />
        </Button>
      </Tip>

      <div className="flex shrink-0 items-center gap-1 border-l border-ink-hair pl-2">
        <Tip text={HINT.movePhaseBack} title="Move earlier" side="top">
          <Button
            onClick={() => moveAct(-1)}
            disabled={actIndex === 0 || system.acts.length < 2}
            aria-label={`Move this ${PHASE.one} earlier in the order`}
          >
            ↤ Move
          </Button>
        </Tip>
        <Tip text={HINT.movePhaseOn} title="Move later" side="top">
          <Button
            onClick={() => moveAct(1)}
            disabled={actIndex === system.acts.length - 1 || system.acts.length < 2}
            aria-label={`Move this ${PHASE.one} later in the order`}
          >
            Move ↦
          </Button>
        </Tip>
        <Tip text={HINT.deletePhase} title={`Delete ${PHASE.one}`} side="top">
          <Button variant="danger" onClick={deleteAct} disabled={system.acts.length <= 1}>
            Delete
          </Button>
        </Tip>
      </div>
    </footer>
  )

  // ── the setup panel (left on a wide screen) ────────────────────────────────
  const setupPanel = (
    <>
      <Panel title="Pitch view">
        <Tip text={HINT.pitchView} title="Pitch view" block>
          <Select
            value={system.pitch}
            onChange={setPitch}
            options={PITCH_VIEW_LIST.map((v) => ({ value: v.id, label: v.label }))}
          />
        </Tip>
        <p className="mt-2 text-[11px] leading-snug text-ink-faint">
          <span className="text-ink-soft">{view.hint}</span> {view.useFor}
        </p>
        {cast.partial && (
          <Tip text={HINT.pitchFit} title="Who fits on this view" block>
            <p className="mt-2 rounded-md bg-paper px-2 py-1.5 text-[11px] leading-snug text-ink-faint">
              A shape placed here puts on{' '}
              <span className="font-bold text-ink-soft">{cast.us} of yours</span>
              {system.teams.them ? (
                <>
                  {' '}
                  and <span className="font-bold text-ink-soft">{cast.them} of theirs</span>
                </>
              ) : null}
              . This part of the pitch cannot hold a full team.
            </p>
          </Tip>
        )}
      </Panel>

      <Panel title="Our shape">
        <Tip text={HINT.formationUs} title="Our shape" block>
          <Select value={usFormation} onChange={(v) => applyFormation('us', v)} groups={formationGroups} />
        </Tip>
        <p className="mt-2 text-[11px] leading-snug text-ink-faint">{FORMATION_BY_ID.get(usFormation)?.hint}</p>
        <div className="mt-3">
          <Tip text={HINT.colourUs} title="Our colour" block>
            <ColorWell value={system.teams.us.base} onChange={(c) => setTeamColor('us', c)} label="Our colour" />
          </Tip>
        </div>
        <div className="mt-3">
          <Tip
            text={
              usIsBlank
                ? 'Puts all eleven back on the touchline so you can lay them out again from scratch.'
                : HINT.replace
            }
            title={usIsBlank ? 'Back to the touchline' : 'Re-place shapes'}
          >
            <Button onClick={replaceShapes}>{usIsBlank ? 'Back to the touchline' : 'Re-place shapes'}</Button>
          </Tip>
        </div>
      </Panel>

      <Panel title="Opposition">
        <Tip text={HINT.opposition} title="Show opposition" block>
          <Toggle checked={Boolean(system.teams.them)} onChange={toggleOpposition} label="Show opposition" />
        </Tip>
        {system.teams.them && (
          <div className="mt-3">
            <Tip text={HINT.formationThem} title="Their shape" block>
              <Select value={themFormation} onChange={(v) => applyFormation('them', v)} groups={formationGroups} />
            </Tip>
            <div className="mt-3">
              <Tip text={HINT.colourThem} title="Their colour" block>
                <ColorWell
                  value={system.teams.them.base}
                  onChange={(c) => setTeamColor('them', c)}
                  label="Their colour"
                />
              </Tip>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Match ball">
        <Tip text={HINT.ball} title="Match ball" block>
          <PicturePicker
            label="Match ball"
            value={system.matchBall ?? DEFAULT_BALL}
            onChange={(id: BallId) => {
              edit('ball', (s) => ({ ...s, matchBall: id }))
              seal()
            }}
            items={BALLS.map((b) => ({ value: b.id, label: b.name, src: b.src }))}
          />
        </Tip>
        <p className="mt-2 text-[11px] leading-snug text-ink-faint">
          <span className="font-bold text-ink-soft">{ball.name}.</span> {ball.story}
        </p>
      </Panel>

      <Panel title="Pitch">
        <Tip text={HINT.surface} title="What the pitch is drawn on" block>
          <SurfacePicker
            label="Pitch"
            value={system.surface ?? DEFAULT_SURFACE}
            onChange={(id: PitchSurfaceId) => {
              edit('surface', (s) => ({ ...s, surface: id }))
              seal()
            }}
            items={PITCH_SURFACES.map((s) => ({ value: s.id, label: s.name, palette: s.palette }))}
          />
        </Tip>
        <p className="mt-2 text-[11px] leading-snug text-ink-faint">
          <span className="font-bold text-ink-soft">{surface.name}.</span> {surface.story}
        </p>
      </Panel>

      <Panel title="Camera">
        <Tip text={HINT.camera} title="How the film is shot" block>
          <Segmented
            label="Camera"
            value={camera}
            onChange={(id: CameraMode) => {
              edit('camera', (s) => ({ ...s, camera: id }))
              seal()
            }}
            options={CAMERA_MODES.map((c) => ({ value: c.id, label: c.label }))}
          />
        </Tip>
        <p className="mt-2 text-[11px] leading-snug text-ink-faint">
          <span className="font-bold text-ink-soft">{cameraMode.label}.</span> {cameraMode.hint}
        </p>
        {camera === 'follow' && (
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            {rendered.shot ? (
              <>
                This {PHASE.one} is shot{' '}
                <span className="font-bold text-ink-soft">{Math.round(frameWide)} metres</span>{' '}
                across, out of {Math.round(viewWide)}. The dashed box is what the film sees.
              </>
            ) : (
              <>
                This {PHASE.one} is shot wide. Put the ball on the board, or draw an arrow, and the
                camera has something to point at.
              </>
            )}
          </p>
        )}
      </Panel>

      <Panel title="Counters">
        <Tip text={HINT.labels} title="What is on the counters" block>
          <Select
            value={labels}
            onChange={applyLabels}
            options={[
              { value: 'position', label: 'Positions (CB, DM, ST)' },
              { value: 'number', label: 'Shirt numbers' },
            ]}
          />
        </Tip>
      </Panel>

      <Panel title={`Players on this ${PHASE.one}`}>
        <div className="flex flex-wrap gap-1.5">
          <Tip text={HINT.ballToggle} title={act.ball ? 'Remove ball' : 'Add ball'}>
            <Button
              onClick={() => {
                patchAct('ball-on', (a) => ({ ...a, ball: a.ball ? null : { ...CENTRE_SPOT } }))
                seal()
              }}
              active={Boolean(act.ball)}
            >
              {act.ball ? 'Remove ball' : 'Add ball'}
            </Button>
          </Tip>
          <Tip text={HINT.addPlayer} title="Add a player">
            <Button onClick={() => addPlayer('us')}>+ Player</Button>
          </Tip>
          <Tip text={HINT.clearPitch} title="Clear the pitch">
            <ConfirmButton
              confirm="Yes, clear them"
              onConfirm={() => {
                patchAct('clear-players', (a) => ({ ...a, tokens: [] }))
                seal()
              }}
              disabled={act.tokens.length === 0}
            >
              Clear players
            </ConfirmButton>
          </Tip>
        </div>
      </Panel>

      {/*
       * Shaded areas, all in one place and all explained.
       *
       * "Add block" on its own was the least understood control in the studio:
       * a coach pressed it, half the pitch went green, and nothing said what had
       * been decided on their behalf. Sitting it next to the two areas you draw
       * by hand makes the shape of the idea obvious — one is worked out from
       * your players, two are drawn where you say.
       */}
      <Panel title="Shaded areas">
        <p className="mb-2.5 text-[11px] leading-snug text-ink-faint">
          The block is worked out from your deepest line and follows it. The other two you drag out yourself.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Tip text={HINT.block} title={blockFor('us') ? 'Redraw our block' : 'Our block'}>
            <Button onClick={() => addBlockBand('us')} active={Boolean(blockFor('us'))}>
              {blockFor('us') ? 'Redraw our block' : 'Our block'}
            </Button>
          </Tip>
          {system.teams.them && (
            <Tip text={HINT.blockThem} title={blockFor('them') ? 'Redraw their block' : 'Their block'}>
              <Button onClick={() => addBlockBand('them')} active={Boolean(blockFor('them'))}>
                {blockFor('them') ? 'Redraw their block' : 'Their block'}
              </Button>
            </Tip>
          )}
          {ZONE_TOOL_IDS.map((id) => (
            <Tip key={id} text={<ToolText id={id} />} title={TOOL_DOC[id].label}>
              <Button active={tool === id} onClick={() => setTool(tool === id ? 'select' : id)}>
                {TOOL_DOC[id].label}
              </Button>
            </Tip>
          ))}
        </div>
        {blockFor('us') && (
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">{HINT.blockRedraw}</p>
        )}
      </Panel>

      <Panel title="This system">
        <Tip text={HINT.reset} title="Start over">
          <ConfirmButton confirm="Yes, start over" onConfirm={startOver}>
            Start over
          </ConfirmButton>
        </Tip>
        <p className="mt-2 text-[11px] leading-snug text-ink-faint">
          Everything you do is saved on this computer as you go. Undo takes back anything, including this.
        </p>
      </Panel>
    </>
  )

  // ── the phase panel (right on a wide screen) ───────────────────────────────
  // The chips in this list are the marks that are on the board, so they are
  // tinted from the board's own palette rather than from paper's: a run arrow
  // listed in #06A659 beside a run arrow drawn in mint is two different things.
  const arrows = arrowStyle(surface.palette)
  const bands = bandStyle(surface.palette)
  const marks: { id: string; name: string; tone: string; kind: 'arrow' | 'band' }[] = [
    ...act.arrows.map((a) => ({
      id: a.id,
      name: TOOL_DOC[a.kind].label,
      tone: arrows[a.kind].color,
      kind: 'arrow' as const,
    })),
    ...act.bands.map((b) => ({
      id: b.id,
      name: markName(b, act),
      tone: bands[b.kind].tone,
      kind: 'band' as const,
    })),
  ]

  const phasePanel = (
    <>
      <Panel title={`${PHASE.One} ${actIndex + 1} of ${system.acts.length}`}>
        <Field label="Title">
          <Tip text={HINT.phaseTitle} title="Title" side="left" block>
            <TextInput
              value={act.title}
              onChange={(v) => patchAct('phase-title', (a) => ({ ...a, title: v }))}
              placeholder="What this moment shows"
              maxLength={60}
            />
          </Tip>
        </Field>
        <Field label="Caption">
          <Tip text={HINT.phaseCaption} title="Caption" side="left" block>
            <TextArea
              value={act.caption}
              onChange={(v) => patchAct('phase-caption', (a) => ({ ...a, caption: v }))}
              placeholder="One line a coach can read at a glance"
            />
          </Tip>
        </Field>
        <Field label="Description (optional)">
          <Tip text={HINT.phaseNotes} title="Description" side="left" block>
            <TextArea
              value={act.notes ?? ''}
              onChange={(v) => patchAct('phase-notes', (a) => ({ ...a, notes: v || undefined }))}
              placeholder="Coaching points, triggers, what to look for"
              rows={4}
            />
          </Tip>
        </Field>
      </Panel>

      {selectedToken ? (
        <Panel title="Selected player">
          <Field label="On the counter">
            <Tip text={HINT.playerLabel} title="On the counter" side="left" block>
              <TextInput value={selectedToken.label} onChange={(v) => patchToken({ label: v }, 'label')} maxLength={4} />
            </Tip>
          </Field>
          <Field label="Name (optional)">
            <Tip text={HINT.playerName} title="Name" side="left" block>
              <TextInput
                value={selectedToken.name ?? ''}
                onChange={(v) => patchToken({ name: v || undefined }, 'name')}
                placeholder="Printed above the counter"
                maxLength={18}
              />
            </Tip>
          </Field>
          <Field label="Role cue">
            <Tip text={HINT.playerCue} title="Role cue" side="left" block>
              <Select
                value={(selectedToken.cue ?? '') as string}
                onChange={(v) => patchToken({ cue: (v || undefined) as Cue | undefined }, 'cue')}
                options={[{ value: '', label: 'None' }, ...CUES.map((c) => ({ value: c as string, label: c }))]}
              />
            </Tip>
          </Field>
          <Tip text={HINT.playerDim} title="Fade back" side="left" block>
            <Toggle
              checked={Boolean(selectedToken.dim)}
              onChange={(v) => patchToken({ dim: v || undefined }, 'dim')}
              label="Fade back"
            />
          </Tip>
          <div className="mt-3">
            <Tip text={HINT.playerRemove} title="Remove" side="left">
              <Button variant="danger" onClick={deleteSelection}>
                Remove from this {PHASE.one}
              </Button>
            </Tip>
          </div>
        </Panel>
      ) : selectedArrow ? (
        <Panel title={`Selected ${TOOL_DOC[selectedArrow.kind].label.toLowerCase()}`}>
          <p className="mb-3 text-[11px] leading-relaxed text-ink-faint">{TOOL_DOC[selectedArrow.kind].what}</p>
          <Field label="Bend">
            <input
              type="range"
              min={-1}
              max={1}
              step={0.1}
              value={selectedArrow.bend ?? 0}
              onChange={(e) => patchMark({ bend: Number(e.target.value) || undefined })}
              className="w-full accent-ink"
              aria-label="How much the arrow bows"
            />
          </Field>
          <Field label="Label (optional)">
            <TextInput
              value={selectedArrow.label ?? ''}
              onChange={(v) => patchMark({ label: v || undefined })}
              placeholder="Printed on the arrow"
              maxLength={18}
            />
          </Field>
          <Tip text={HINT.deleteMark} title="Delete" side="left">
            <Button variant="danger" onClick={deleteSelection}>
              Delete this arrow
            </Button>
          </Tip>
        </Panel>
      ) : selectedBand ? (
        <Panel title={`Selected ${markName(selectedBand, act).toLowerCase()}`}>
          <p className="mb-3 text-[11px] leading-relaxed text-ink-faint">
            {selectedBand.kind === 'block'
              ? 'Tied to the players it runs through. Drag any of them and it reshapes.'
              : TOOL_DOC[selectedBand.kind].what}
          </p>
          <Tip text={HINT.deleteMark} title="Delete" side="left">
            <Button variant="danger" onClick={deleteSelection}>
              Delete this area
            </Button>
          </Tip>
        </Panel>
      ) : (
        <Panel title="Nothing selected">
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Click a counter to rename it, give it a role cue, or fade it back. Click an arrow or a shaded area to
            change it or take it off. A player removed here is only gone from this {PHASE.one}.
          </p>
        </Panel>
      )}

      {/*
       * Everything drawn on this phase, as a list.
       *
       * The board is the natural place to click an arrow and the list is the
       * reliable one: arrows overlap, a short one under a counter is hard to
       * hit, and a coach who wants "that pass, not this one" gone should not
       * have to fight for it. Clearing all of them is still here, one row down,
       * where it stops being the only option and becomes a shortcut.
       */}
      <Panel title={`Marks on this ${PHASE.one}`}>
        {marks.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Nothing drawn yet. Pick Pass, Run, Carry, Press or Switch at the top and drag on the board.
          </p>
        ) : (
          <>
            <p className="mb-2 text-[11px] leading-snug text-ink-faint">{HINT.marks}</p>
            <ul className="space-y-1">
              {marks.map((m) => (
                <li
                  key={m.id}
                  className={`flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors ${
                    selectedMarkId === m.id ? 'bg-ink-hair' : 'hover:bg-ink-hair/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelection({ kind: 'mark', id: m.id })}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {/* The dot sits on a disc of the board's own ground, which
                        is both a truer picture of the mark and the only way it
                        reads: on the chalk surface a pass is drawn in near
                        white, and a bare white dot on a day-mode panel is
                        nothing at all. */}
                    <span
                      className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-ink-hair"
                      style={{ background: surface.palette.halo }}
                      aria-hidden="true"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: m.tone }} />
                    </span>
                    <span className="truncate text-[11px] font-bold text-ink-soft">{m.name}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete this ${m.name.toLowerCase()}`}
                    onClick={() => {
                      patchAct('delete-mark', (a) => ({
                        ...a,
                        arrows: a.arrows.filter((x) => x.id !== m.id),
                        bands: a.bands.filter((b) => b.id !== m.id),
                      }))
                      seal()
                      if (selectedMarkId === m.id) setSelection(null)
                    }}
                    className="shrink-0 rounded px-1.5 text-xs font-bold text-ink-faint transition-colors hover:text-[#E2473B]"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Tip text={HINT.clearArrows} title="Clear arrows">
                <Button
                  onClick={() => {
                    patchAct('clear-arrows', (a) => ({ ...a, arrows: [] }))
                    seal()
                  }}
                  disabled={act.arrows.length === 0}
                >
                  Clear arrows
                </Button>
              </Tip>
              <Tip text={HINT.clearZones} title="Clear zones">
                <Button
                  onClick={() => {
                    patchAct('clear-zones', (a) => ({ ...a, bands: [] }))
                    seal()
                  }}
                  disabled={act.bands.length === 0}
                >
                  Clear areas
                </Button>
              </Tip>
            </div>
          </>
        )}
      </Panel>
    </>
  )

  const rail = (
    <GuideRail
      done={railDone}
      open={guide.railOpen}
      onToggle={(o) => markGuide({ railOpen: o })}
      onReplay={() => setWalkthrough(true)}
    />
  )

  const overlays = (
    <>
      {walkthrough && (
        <Walkthrough
          onClose={() => {
            setWalkthrough(false)
            markGuide({ seen: true })
          }}
        />
      )}
      {sharing && (
        <ShareDialog
          system={system}
          onCredit={patchCredit}
          onPublished={rememberShareId}
          onClose={() => setSharing(false)}
        />
      )}
      {makingVideo && <VideoDialog system={system} onClose={() => setMakingVideo(false)} />}
    </>
  )

  // ── stacked: the board on top, one panel under it ──────────────────────────
  if (stacked) {
    return (
      <div className="flex h-[100dvh] flex-col bg-paper-deep text-ink">
        {toolbar}
        <main className="flex shrink-0 select-none flex-col items-center gap-2 p-3">
          <div className="flex h-[36dvh] min-h-[180px] w-full items-center justify-center">{boardStage}</div>
          {boardLine}
        </main>
        {phaseStrip}
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-ink-hair bg-surface">
          <div className="sticky top-0 z-10 border-b border-ink-hair bg-surface p-2">
            <Segmented
              label="Which controls to show"
              value={panelTab}
              onChange={setPanelTab}
              options={[
                { value: 'setup', label: 'Set up' },
                { value: 'phase', label: `This ${PHASE.one}` },
              ]}
            />
          </div>
          {panelTab === 'setup' ? setupPanel : phasePanel}
          {rail}
        </div>
        {overlays}
      </div>
    )
  }

  // ── wide: panel, board, panel ──────────────────────────────────────────────
  return (
    <div className="flex h-[100dvh] min-h-[620px] flex-col bg-paper-deep text-ink">
      {toolbar}

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-ink-hair bg-surface">{setupPanel}</aside>

        <main className="flex min-w-0 flex-1 select-none flex-col items-center justify-center gap-3 overflow-hidden p-6">
          {boardStage}
          {boardLine}
        </main>

        <aside className="w-64 shrink-0 overflow-y-auto border-l border-ink-hair bg-surface">
          {rail}
          {phasePanel}
        </aside>
      </div>

      {phaseStrip}
      {overlays}
    </div>
  )
}

// ── small pieces ─────────────────────────────────────────────────────────────

/** A rectangle in percent space from two dragged corners, always positive. */
function rectOf(a: { x: number; y: number }, b: { x: number; y: number }) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  }
}

/** What to call a mark in a list or a panel title. */
function markName(mark: Arrow | Band, act: Act): string {
  if ('throughTokens' in mark && mark.throughTokens?.length) {
    return bandSide(mark, act) === 'us' ? 'Our block' : 'Their block'
  }
  if (mark.kind === 'block') return 'Block'
  return TOOL_DOC[mark.kind].label
}

/**
 * A tool's tooltip: what it means, then when to reach for it.
 *
 * The second line is the one that matters. A coach can work out that Pass draws
 * a passing arrow; what they cannot work out is that a switch is for the one
 * ball that moves the whole opposition, and a board where everything is a
 * switch says nothing.
 */
function ToolText({ id }: { id: ToolId }) {
  return (
    <>
      {TOOL_DOC[id].what}
      <span className="mt-1.5 block text-ink-faint">
        <span className="font-bold uppercase tracking-micro text-[9px]">When</span> {TOOL_DOC[id].when}
      </span>
    </>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 12 12" className="h-4 w-4" aria-hidden="true">
      <path
        d={dir === 'left' ? 'M7.5 2 L3.5 6 L7.5 10' : 'M4.5 2 L8.5 6 L4.5 10'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Undo / redo. A turning arrow, which is what everyone else's undo looks like. */
function Arc({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      aria-hidden="true"
      style={dir === 'right' ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M3 7.5 A5 5 0 1 1 5.2 12.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M3 3.4 V7.7 H7.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * A fresh system: one phase, our 4-3-3, ball on the centre spot, no opposition.
 *
 * The ball is ON. It was off, and every single board a coach built began with
 * the same click to turn it on — a football board without a ball is not a
 * neutral starting point, it is an unfinished one. Turning it off is one click
 * for the rare act that is about shape alone, and every act after this one is a
 * copy of the one before it, so this decides the ball for the whole document.
 */
export function newSystem(): System {
  const f = FORMATION_BY_ID.get('4-3-3')!
  return {
    v: 1,
    title: '',
    pitch: 'full',
    matchBall: DEFAULT_BALL,
    surface: DEFAULT_SURFACE,
    teams: { us: DEFAULT_US, them: null },
    acts: [
      {
        ...emptyAct(place(f, 'us', 'full', 'position', true)),
        title: `${PHASE.One} 1`,
        ball: { ...CENTRE_SPOT },
      },
    ],
  }
}
