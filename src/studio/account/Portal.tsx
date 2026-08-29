/**
 * The portal: everything a coach has built, and the way into a new one.
 *
 * This is not the studio and must not try to be. The studio is a tool you are
 * inside; this is the shelf you take things off. So: no board controls, no
 * tools, nothing that edits a document. One decision per card — open it — and
 * the rest of the row kept quiet underneath.
 *
 * THE THUMBNAILS ARE REAL BOARDS. Each card renders the system's first phase
 * through the same `Board` the editor and the viewer use, at card size. It
 * costs an SVG per card and it is worth it: a coach recognises their own 4-3-3
 * instantly and cannot recognise "System 4 — 3 phases" at all. It also means a
 * shelf of systems is the first thing they see that looks like the videos.
 *
 * WHAT A CARD SAYS ABOUT ITS SYSTEM. Three things, and each is something a coach
 * cannot work out from the picture: how long it is, when they last touched it,
 * and whether it is out in the world. The last one used to be invisible, which
 * meant the only way to find out whether a system had a link — and therefore
 * whether editing it would change what somebody had already been sent — was to
 * open it and press Share.
 *
 * WHAT HAPPENS ON FIRST SIGN-IN. The studio works with no account, so the
 * ordinary path is: build something, like it, then sign up. `claimLocalSystems`
 * runs before the first list and moves whatever is in this browser into the
 * account, keeping ids. If that did not happen, signing up would be the moment
 * a coach's work vanished, and adoption-first would be worse than a login wall.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Board } from '../board/Board'
import { PITCH_VIEWS, aspect, resolveViewId, viewFor } from '../board/pitch'
import type { System } from '../schema'
import { listSystems, newSystemId, saveSystem, deleteSystem as deleteLocal } from '../storage'
import { templateUrl } from '../share'
import { STUDIO_EVENTS, track } from '../track'
import { TEMPLATES, type Template } from '../templates'
import { resolveAct } from '../tween'
import { Mark } from '../viewer/Mark'
import { hydratePrefs } from './prefs'
import { useSession, signOut } from './session'
import { hydrateProfile } from './profile'
import { profileCompletion, shouldNudge, type Completion } from './completion'
import { EMPTY_PROFILE } from './cloud'
import { ProfileNudge } from './ProfileNudge'
import { readGuide, writeGuide } from '../storage'
import {
  claimLocalSystems,
  deleteCloudSystem,
  listCloudSystems,
  saveCloudSystem,
  saveProfile,
  type CloudSystem,
} from './cloud'
import { Modal, Button } from '../editor/ui'
import { useProfile, putProfile } from './profile'

type Load = 'working' | 'ready' | 'local-only'

/** The shape a card's picture takes before it has one. Also the new tile's. */
const CARD_ASPECT = aspect(PITCH_VIEWS[resolveViewId(undefined)])

/** Quiet chrome action — Settings, Sign out. Present, never competing. */
const QUIET =
  'rounded-full px-3.5 py-2 text-sm font-semibold text-ink-soft no-underline transition-colors hover:bg-ink-hair hover:text-ink'

export default function Portal() {
  const { status, user } = useSession()
  const [systems, setSystems] = useState<CloudSystem[]>([])
  const [load, setLoad] = useState<Load>('working')
  const [claimed, setClaimed] = useState(0)
  const [folderSystem, setFolderSystem] = useState<CloudSystem | null>(null)
  const { profile } = useProfile(user?.id)

  /*
   * ── FINISHING THE PROFILE ────────────────────────────────────────────────
   *
   * Held as one nullable value rather than as `{ completion, open }`, because
   * there is no state in which the panel is open without something to say. Null
   * is "nothing to offer", which covers a complete profile, a coach who has
   * turned it off, one who was asked too recently, and a failed fetch — all of
   * which should behave identically, and none of which is worth telling anybody
   * about. See ./completion.ts for the cadence.
   */
  const [nudge, setNudge] = useState<Completion | null>(null)
  /*
   * How finished the profile is, whatever the prompt is doing.
   *
   * Held apart from `nudge` because the two are answering different questions.
   * `nudge` is "is it fair to interrupt this coach today", and its answer is no
   * on most days by design. This one is "is there anything left", and its answer
   * is allowed to be visible every single day, because what it drives is a
   * count on a link that was already in the header — something a coach reads if
   * they look at it and never has to dismiss.
   *
   * That split is what let the prompt's cadence be tightened without it becoming
   * an advert: the persistent, silent surface carries the reminding, and the
   * panel goes back to being an offer. See GAPS in ./completion.ts.
   */
  const [completion, setCompletion] = useState<Completion | null>(null)

  // Signed out: go and sign in, and come back here afterwards.
  useEffect(() => {
    if (status !== 'out') return
    const next = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.replace(`/studio/login/?next=${next}`)
  }, [status])

  const refresh = useCallback(async (owner: string, claim: boolean) => {
    // Before the claim and before the nudge: the cadence in ./completion.ts
    // reads counters that may only exist on the account, and asking a coach to
    // finish their profile for the fourth time because this laptop had never
    // heard of the first three is the exact failure the cadence is there to
    // prevent. See ./prefs.ts.
    await hydratePrefs(owner)
    if (claim) {
      const n = await claimLocalSystems(owner)
      if (n) setClaimed(n)
    }
    /*
     * ── THE SHELF IS THE ACCOUNT'S, NOT THIS MACHINE'S ──────────────────────
     *
     * An empty list USED TO BE ambiguous — a new account and an unreachable
     * server both came back as `[]`, so this fell through to the local buffer
     * either way and a brand new account could be shown work from a browser it
     * had nothing to do with. `listCloudSystems` now returns null for a failed
     * fetch and an array for an answer, so the two cases are told apart:
     *
     *   an array, of any length -> that IS the shelf. An empty account has an
     *                              empty shelf, and saying so is correct.
     *   null                    -> we could not ask. Only then does the buffer
     *                              stand in, and it is labelled 'local-only'.
     */
    const rows = await listCloudSystems(owner)
    if (rows) {
      setSystems(rows)
      setLoad('ready')
      return
    }
    const local = listSystems()
    setSystems(local.map((l) => ({ id: l.id, system: l.system, updated: l.updated })))
    setLoad(local.length ? 'local-only' : 'ready')
  }, [])

  useEffect(() => {
    if (status !== 'in' || !user) return
    void refresh(user.id, true)
  }, [status, user, refresh])

  /*
   * Decided once the shelf has landed, and never before it.
   *
   * `load` is in the dependencies for a real reason: the cadence needs to know
   * how long this coach has been using the tool, and the honest answer to that
   * is on the shelf — the date of the oldest system they own. Asking before the
   * fetch resolves would read an empty shelf and conclude they are brand new,
   * which is precisely the coach the prompt is supposed to leave alone.
   *
   * A failed profile fetch is silence. There is nothing here worth an error
   * message: the coach came to open a system, and a portal that greets them
   * with "we could not check your profile" has made their day worse over
   * something that was never their business.
   */
  /*
   * ── SEEING IT ON PURPOSE: /studio/portal/?nudge ──────────────────────────
   *
   * Everything below is built to make this panel appear rarely and only to the
   * right person, which is correct and has one bad consequence: nobody who
   * works on it can look at it. Whoever tunes the copy has a finished profile,
   * a shelf years old and a `profileNudges` count long since spent, so the one
   * state they can never reach is the one every new coach starts in (user,
   * 2026-08-28: "i dont see at all the studio popup").
   *
   * The flag skips the cadence, not the panel. Nothing is stamped, so looking
   * at it does not spend one of a real coach's asks, and the guard against
   * `profileNudgeOff` is skipped too — a preview that silently did nothing
   * because of a flag set months ago is the same problem again.
   *
   * If the profile really is finished there is nothing to list, so the preview
   * falls back to an empty one and SAYS SO on the card. A harness that shows
   * you invented data without admitting it is how somebody ends up tuning copy
   * against a state that cannot occur.
   *
   * Same posture as /studio/preview/ and /studio/shoot/: no product behaviour
   * changes, and there is nothing here to protect — it reads the viewer's own
   * profile, in the viewer's own browser, and writes nothing.
   */
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    setPreview(new URLSearchParams(window.location.search).has('nudge'))
  }, [])

  useEffect(() => {
    if (status !== 'in' || load === 'working' || !user) return
    let live = true
    /*
     * Through the shared store (./profile.ts), so this is the same single read
     * the editor and the settings page use rather than a fourth request for one
     * row.
     *
     * 'NONE' AND 'ERROR' ARE NOT THE SAME ANSWER, and reading them as one was
     * why neither the count nor the prompt ever appeared for the coach they
     * were written for (user, 2026-08-28). Both arrive here with a null
     * `profile`, so testing the row was testing the wrong thing:
     *
     *   'error' -> we could not ask. Nothing is known, so say nothing: a count
     *              of seven guessed off a failed fetch is a lie on a link.
     *   'none'  -> we asked, and this account has never saved a profile. That
     *              is not an absence of information, it is the fullest answer
     *              the question has — every step is unfinished — and it is
     *              exactly the state a brand new account is in. `Settings.tsx`
     *              has always read it that way; this had not.
     *
     * So 'none' becomes EMPTY_PROFILE and goes through the same arithmetic as a
     * real row, which is honest, because a row of empty strings and no row at
     * all describe the identical coach.
     */
    void hydrateProfile(user.id).then(({ status: read, profile }) => {
      if (!live || read === 'loading' || read === 'error') return
      const completion = profileCompletion(profile ?? EMPTY_PROFILE)
      setCompletion(completion)
      // The oldest thing on the shelf, as a timestamp. `updated` is an ISO
      // string off the row; an unparseable one becomes 0, which reads as "no
      // history" and holds the prompt back rather than firing it wrongly.
      const oldest = systems.reduce((min, r) => {
        const t = Date.parse(r.updated)
        return Number.isFinite(t) ? (min === 0 ? t : Math.min(min, t)) : min
      }, 0)
      if (preview) {
        // A finished profile has an empty list, which shows nothing about the
        // design. Fall back to a blank one — the card says it is a sample.
        setNudge(completion.complete ? profileCompletion(EMPTY_PROFILE) : completion)
        return
      }
      if (!shouldNudge(completion, readGuide(), oldest)) return
      /*
       * Stamped when it is SHOWN, not when it is answered.
       *
       * Dismissing is an answer for our purposes, and so is ignoring it — the
       * same policy the feedback ask is on (../feedback.ts). A coach who left
       * the panel sitting in the corner and got on with their session has been
       * asked, and must not be asked again tomorrow because they never pressed
       * anything.
       */
      writeGuide({ profileNudgedAt: Date.now(), profileNudges: readGuide().profileNudges + 1 })
      track(STUDIO_EVENTS.profileNudge, `shown:${completion.done}of${completion.total}`)
      setNudge(completion)
    })
    return () => {
      live = false
    }
    // `systems` is read for the oldest date only, and re-running this on every
    // rename would re-show a panel the coach has just dismissed. `load` moving
    // off 'working' is the one transition that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, load, user, preview])

  const create = useCallback(() => {
    // Written locally before we navigate, so the editor opens on a real
    // document even if the network is having a bad day. The write-through cache
    // in the editor pushes it up from there.
    track(STUDIO_EVENTS.newSystem)
    const id = newSystemId()
    window.location.href = `/studio/new/?s=${encodeURIComponent(id)}`
  }, [])

  const duplicate = useCallback(
    async (row: CloudSystem) => {
      if (!user) return
      const id = newSystemId()
      const copy: System = {
        ...structuredClone(row.system),
        title: row.system.title ? `${row.system.title} (copy)` : '',
        // A copy is not published. Keeping the shareId would mean pressing
        // Share on the duplicate silently overwrote the original's link.
        shareId: undefined,
      }
      saveSystem(id, copy)
      await saveCloudSystem(id, copy, user.id)
      void refresh(user.id, false)
    },
    [user, refresh],
  )

  const rename = useCallback(
    async (row: CloudSystem, title: string) => {
      if (!user) return
      const next = { ...row.system, title }
      setSystems((s) => s.map((r) => (r.id === row.id ? { ...r, system: next } : r)))
      saveSystem(row.id, next)
      await saveCloudSystem(row.id, next, user.id)
    },
    [user],
  )

  const move = useCallback(
    async (row: CloudSystem, folder: string) => {
      if (!user) return
      const next = { ...row.system, folder }
      setSystems((s) => s.map((r) => (r.id === row.id ? { ...r, system: next } : r)))
      saveSystem(row.id, next)
      await saveCloudSystem(row.id, next, user.id)
    },
    [user],
  )

  const remove = useCallback(
    async (row: CloudSystem) => {
      if (!user) return
      setSystems((s) => s.filter((r) => r.id !== row.id))
      deleteLocal(row.id)
      await deleteCloudSystem(row.id, user.id)
    },
    [user],
  )

  /** The shelf in three numbers. Only the ones that are true get shown. */
  const tally = useMemo(() => {
    const phases = systems.reduce((n, r) => n + r.system.acts.length, 0)
    const shared = systems.filter((r) => r.system.shareId).length
    return { systems: systems.length, phases, shared }
  }, [systems])

  if (status !== 'in') {
    return (
      <Centre>{status === 'unknown' ? 'Opening your shelf…' : 'Taking you to sign in…'}</Centre>
    )
  }

  return (
    <div className="mx-auto max-w-shell px-5 py-12 sm:py-16">
      <header className="border-b border-ink-hair pb-7">
        <p className="text-micro uppercase text-ink-faint">Your shelf</p>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
          <div>
            <h1 className="text-title font-black tracking-display text-ink">Your systems</h1>
            {load !== 'working' && systems.length > 0 && (
              <>
                <Tally {...tally} />
                <DownToOurs />
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Which account this is. The one question the chrome can answer
                that the page cannot, and the reason a coach with a club address
                and a personal one ever knows which shelf they are looking at. */}
            {user?.email && (
              <span
                className="mr-2 hidden max-w-[15rem] truncate text-[13px] text-ink-faint lg:block"
                title={user.email}
              >
                {user.email}
              </span>
            )}
            {/*
              Ringed while the panel is up, and only while it is up.
              
              The panel says WHAT is missing; this says WHERE. A prompt with its
              own button teaches a coach nothing about the page they will need
              again next month, and a ringed link with no explanation is a
              decoration — the two of them together are the whole point of
              docking the panel rather than putting it in a modal over the top
              of this. See ./ProfileNudge.tsx.
            */}
            <a
              href="/studio/settings/"
              className={`${QUIET} inline-flex items-center gap-2 ${
                nudge
                  ? 'relative bg-ink-hair text-ink ring-2 ring-inset ring-ink/20 motion-safe:animate-pulse'
                  : ''
              }`}
            >
              Personal settings
              {/*
                A count, and nothing else.
                
                Not a red dot, not an exclamation mark, not the word "incomplete".
                Nothing has gone wrong and nobody is late — a coach does not owe
                us a filled-in profile, and a badge that implies a fault is how a
                reminder turns into a telling-off. A number on a link says there
                are things behind this door, which is true, and says it every
                visit without ever asking to be dealt with.
                
                Gone entirely once the profile is done, rather than turning into
                a tick. A tick is a reward for finishing a form, and this was
                never a form: the seven things are worth doing because of what
                each one changes, and when they are done the right amount of
                chrome to spend on saying so is none.
              */}
              {completion && !completion.complete && (
                <span
                  className="rounded-full bg-ink-hair px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink-soft"
                  title={`${completion.total - completion.done} things on your profile are not filled in yet`}
                >
                  {completion.total - completion.done}
                </span>
              )}
            </a>
            <button
              type="button"
              onClick={() => void signOut().then(() => window.location.replace('/studio/'))}
              className={QUIET}
            >
              Sign out
            </button>
            <button
              type="button"
              onClick={create}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-paper transition hover:-translate-y-px hover:shadow-lift"
            >
              New system
            </button>
          </div>
        </div>
      </header>

      {claimed > 0 && (
        <Notice tone="green">
          <span className="font-bold">
            {claimed} system{claimed === 1 ? '' : 's'} from this browser {claimed === 1 ? 'is' : 'are'}{' '}
            now on your account.
          </span>{' '}
          They will be here on any machine you sign in from.
        </Notice>
      )}

      {load === 'local-only' && (
        <Notice tone="gold">
          <span className="font-bold">Showing what is on this machine.</span> We could not reach your
          account just now. Nothing is lost, and these will sync when the connection comes back.
        </Notice>
      )}

      {load === 'working' ? (
        <Skeleton />
      ) : systems.length === 0 ? (
        <Empty onNew={create} />
      ) : (
        <>
          {(() => {
            const folders = Array.from(new Set(systems.map((s) => s.system.folder).filter(Boolean))) as string[]
            folders.sort()
            return (
              <div className="mt-8 flex flex-col gap-12">
                {folders.map((f) => (
                  <div key={f}>
                    <h3 className="mb-4 text-xl font-bold text-ink">{f}</h3>
                    <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
                      {systems
                        .filter((s) => s.system.folder === f)
                        .map((row) => (
                          <Card
                            key={row.id}
                            row={row}
                            onDuplicate={() => void duplicate(row)}
                            onRename={(t) => void rename(row, t)}
                            onFolderClick={() => setFolderSystem(row)}
                            onDelete={() => void remove(row)}
                          />
                        ))}
                    </ul>
                  </div>
                ))}
                <div>
                  {folders.length > 0 && <h3 className="mb-4 text-xl font-bold text-ink">Uncategorised</h3>}
                  <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    <NewTile onClick={create} />
                    {systems
                      .filter((s) => !s.system.folder)
                      .map((row) => (
                        <Card
                          key={row.id}
                          row={row}
                          onDuplicate={() => void duplicate(row)}
                          onRename={(t) => void rename(row, t)}
                          onFolderClick={() => setFolderSystem(row)}
                          onDelete={() => void remove(row)}
                        />
                      ))}
                  </ul>
                </div>
              </div>
            )
          })()}
        </>
      )}

      <OursToStartFrom />

      {folderSystem && (
        <FolderModal
          currentFolder={folderSystem.system.folder || ''}
          existingFolders={Array.from(new Set([...(profile?.folders || []), ...systems.map(s => s.system.folder).filter(Boolean)])) as string[]}
          onClose={() => setFolderSystem(null)}
          onMove={(f) => {
            void move(folderSystem, f)
            setFolderSystem(null)
            if (f && user && profile && !profile.folders.includes(f)) {
              const next = { ...profile, folders: [...profile.folders, f] }
              putProfile(next)
              void saveProfile(next, user.id)
            }
          }}
        />
      )}

      {nudge && (
        <ProfileNudge
          completion={nudge}
          sample={preview}
          onClose={() => {
            track(STUDIO_EVENTS.profileNudge, 'dismissed')
            setNudge(null)
          }}
          onNever={() => {
            track(STUDIO_EVENTS.profileNudge, 'never')
            writeGuide({ profileNudgeOff: true })
            setNudge(null)
          }}
        />
      )}
    </div>
  )
}

/**
 * The signpost to the section at the foot of the page.
 *
 * A coach with a full shelf never scrolls past it, so five systems they could
 * have started from sit below the fold being no use to anybody. This is the
 * quietest thing that fixes that: a line of small type under the tally, in the
 * column that describes the shelf rather than in the row of buttons that acts
 * on it — because it is a signpost, not an action, and putting it beside
 * "New system" would make it compete with the thing most coaches came here to
 * press.
 *
 * Shown only when there IS a shelf. The empty state has its own door to the
 * same place and does not need two.
 *
 * The arrow drops a little on hover, which is the entire animation budget for
 * a hint: enough to read as "down there", not enough to be a thing that moves
 * on a page of boards.
 */
function DownToOurs() {
  return (
    <a
      href="#start-from-ours"
      className="group mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-faint no-underline transition-colors hover:text-ink"
    >
      Or start from one of ours
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-y-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" />
      </svg>
    </a>
  )
}

// ── one of ours ──────────────────────────────────────────────────────────────

/**
 * Systems of ours, offered as a starting point.
 *
 * Under the shelf rather than mixed into it, and that is the whole layout
 * decision. These are not the coach's systems, and putting them in the same
 * grid would mean a shelf that fills up with seven things they did not make and
 * cannot delete. Below it, the grid still reads as "yours", and this reads as
 * what it is: a second door, in the room, not blocking it.
 *
 * It stays on the page when the shelf is full. A coach who has built three
 * systems is exactly the person who might want to see how we do a switch of
 * play, and hiding it once they are "experienced" would be guessing.
 *
 * ── WHY ONE SECTION AND TWO GRIDS ───────────────────────────────────────────
 *
 * The official ones are the systems that went out as videos, and they lead,
 * because "this is the actual document that video was made from" is the best
 * sentence on the page. But they are TALLER THAN WIDE and the other five are
 * landscape, and a board must be handed a container of its own `aspect(view)`
 * or it renders straight through the letterbox — Board.tsx says so at length.
 * So they cannot share a row, and a single grid would give one 520px-tall card
 * sitting beside three 230px ones with a field of white underneath them.
 *
 * Two grids under one heading is what that constraint leaves, and it turns out
 * to be the more honest layout anyway: the heading can stay "ours" without
 * claiming the five starters were ever published, and the sub-labels say which
 * is which in four words each.
 */
const OFFICIAL = TEMPLATES.filter((t) => t.official)
const STARTERS = TEMPLATES.filter((t) => !t.official)

function OursToStartFrom() {
  return (
    <section id="start-from-ours" className="mt-20 scroll-mt-12 border-t border-ink-hair pt-12">
      <h2 className="text-section font-black tracking-display text-ink">Or start from one of ours</h2>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        Every one of these was built on this board. Open one and it is yours: move the players,
        rewrite the words, keep what is useful.
      </p>

      {OFFICIAL.length > 0 && (
        <>
          <ShelfLabel
            branded
            title="Official — as published on Total Football"
            note="The documents the videos were rendered from, not a copy of them."
          />
          <ul className="mt-5 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {OFFICIAL.map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </ul>
        </>
      )}

      <ShelfLabel
        title="Built for the films"
        note="Shorter, and a good place to start if you have not used the board before."
      />
      <ul className="mt-5 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {STARTERS.map((t) => (
          <TemplateCard key={t.id} template={t} />
        ))}
      </ul>
    </section>
  )
}

/**
 * The line above each of the two grids.
 *
 * Small type, not a second heading level. These separate two rows of the same
 * kind of thing; an <h3> would imply the page has two subjects down here, and
 * it has one — systems of ours — sorted by whether it went out as a film.
 *
 * `branded` puts the mark on the official row, and only there. It is the same
 * geometry the end card of every short draws (see ../viewer/Mark), which is the
 * entire reason it earns the space: a coach who has seen the videos recognises
 * it, and recognising it is the claim these two cards are making. Putting it on
 * the second row as well — or up beside the <h2>, where it would cover both
 * grids — would spend that recognition on five systems that were never
 * published, and it would stop meaning anything on the two that were.
 *
 * `items-center` rather than baseline: an SVG has no useful baseline, and on a
 * narrow screen the note wraps under the title, where centring the mark against
 * the pair is what keeps it looking placed rather than dropped.
 */
function ShelfLabel({
  title,
  note,
  branded = false,
}: {
  title: string
  note: string
  branded?: boolean
}) {
  return (
    <div className="mt-9 flex items-center gap-3 border-t border-ink-hair pt-6">
      {branded && (
        <span className="shrink-0 text-ink" aria-hidden="true">
          <Mark size={26} />
        </span>
      )}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-micro uppercase text-ink">{title}</p>
        <p className="text-[13px] text-ink-faint">{note}</p>
      </div>
    </div>
  )
}

function TemplateCard({ template }: { template: Template }) {
  const { system, watch } = template
  const view = viewFor(system)
  const first = system.acts[0]
  const href = `/studio/new/?t=${encodeURIComponent(template.id)}`
  // Same reason as the shelf's cards: one <defs> namespace per page.
  const idp = useMemo(() => `tpl-${template.id}`, [template.id])

  return (
    <li className="group flex flex-col overflow-hidden rounded-2xl border border-ink-hair bg-surface shadow-paper transition duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <a
        href={href}
        onClick={() => track(STUDIO_EVENTS.templateOpened, template.id)}
        className="flex flex-1 flex-col no-underline"
        aria-label={`Start from ${system.title}`}
      >
        <div
          className="relative w-full overflow-hidden bg-paper"
          style={{ aspectRatio: aspect(view) }}
        >
          <div className="h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.035]">
            {first && <Board system={system} act={resolveAct(first)} idp={idp} />}
          </div>
          {template.official && <OfficialBadge />}
        </div>
        <div className="flex flex-1 flex-col border-t border-ink-hair p-4">
          <span className="block text-[15px] font-bold leading-tight text-ink">{system.title}</span>
          <span className="mt-2 block flex-1 text-[13px] leading-relaxed text-ink-soft">
            {template.teaches}
          </span>
          <span className="mt-3.5 flex items-center gap-2.5">
            <Phases n={system.acts.length} />
            <span className="text-[12px] font-bold text-ink transition-colors group-hover:text-ink">
              Start from this one →
            </span>
          </span>
        </div>
      </a>

      {/* OUTSIDE the anchor above, and it has to be: an <a> inside an <a> is
          invalid, and browsers recover from it by closing the outer one early,
          which would quietly cut the card's own link in half. The copy button
          has the same problem for the same reason — a <button> is interactive
          content too. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-ink-hair bg-paper/60 px-4 py-2.5">
        {watch && (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] font-black uppercase tracking-micro text-ink-faint">
              Watch it
            </span>
            {watch.instagram && (
              <WatchLink href={watch.instagram} where="instagram" template={template} />
            )}
            {watch.facebook && (
              <WatchLink href={watch.facebook} where="facebook" template={template} />
            )}
          </span>
        )}
        {/* `ml-auto` rather than `justify-between`, so this sits right whether
            or not there are watch links to its left. */}
        <span className="ml-auto">
          <CopyLink template={template} />
        </span>
      </div>
    </li>
  )
}

/**
 * "Copy link" — a system of ours, sent to anybody.
 *
 * WHY A TEMPLATE NEEDS THIS AT ALL. The card's own link is `/studio/new/?t=…`,
 * which hands over an editable copy and therefore sits behind the sign-in wall.
 * That is right for the coach standing here and useless for the person they
 * want to show it to: sending it means sending a stranger to a login screen.
 * `/o/press-4141/` needs no account and opens the STUDIO — the real editor,
 * every panel and every phase, with the board locked and a door on it. See
 * src/pages/o/[slug].astro. So the thing a coach passes on is the system AND
 * the tool that drew it, rather than an invitation to sign up before seeing
 * either.
 *
 * The link is built from `window.location.origin` rather than the site config
 * because a deploy preview must copy a link to ITSELF. A card on a preview that
 * copies a production URL is a card that cannot be tested.
 */
function CopyLink({ template }: { template: Template }) {
  const [done, setDone] = useState(false)

  const copy = useCallback(async () => {
    const url = templateUrl(template.id, window.location.origin)
    track(STUDIO_EVENTS.templateShared, template.id)
    try {
      await navigator.clipboard.writeText(url)
      setDone(true)
      window.setTimeout(() => setDone(false), 1800)
    } catch {
      // Clipboard refused — an insecure context, or permission denied. A prompt
      // is ugly and it is still a link the coach can select and copy, which is
      // the whole job. Failing silently here would look like a dead button.
      window.prompt('Copy this link', url)
    }
  }, [template.id])

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-bold text-ink-soft transition-colors hover:bg-ink-hair hover:text-ink"
    >
      {done ? (
        <>
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 text-green"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m3 8.5 3.5 3.5L13 5" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="5.5" y="5.5" width="8" height="8" rx="2" />
            <path d="M10.5 3.5A2 2 0 0 0 8.5 2h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 1.5 1.94" />
          </svg>
          Copy link
        </>
      )}
    </button>
  )
}

/**
 * The mark on an official card's board.
 *
 * On the picture rather than in the text block, because the picture is what a
 * coach is scanning and the badge's whole job is to be caught in that scan. The
 * brand gradient is used here and almost nowhere else in the portal, which is
 * the point: it is the channel's signature, and this is the one place on the
 * shelf that is claiming to be the channel.
 */
function OfficialBadge() {
  return (
    <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-tf-gradient px-2.5 py-1 text-[10px] font-black uppercase tracking-micro text-[#161618] shadow-paper">
      Official
    </span>
  )
}

function WatchLink({
  href,
  where,
  template,
}: {
  href: string
  where: 'instagram' | 'facebook'
  template: Template
}) {
  const label = where === 'instagram' ? 'Instagram' : 'Facebook'
  return (
    <a
      href={href}
      target="_blank"
      // noreferrer as well as noopener: the target is a social platform, and
      // there is no reason to hand it the URL of a coach's private shelf.
      rel="noopener noreferrer"
      onClick={() => track(STUDIO_EVENTS.officialWatched, `${template.id}:${where}`)}
      className="text-[12px] font-bold text-ink-soft no-underline underline-offset-2 transition-colors hover:text-ink hover:underline"
    >
      {label} ↗
    </a>
  )
}

// ── the shelf in numbers ─────────────────────────────────────────────────────

/**
 * Systems, phases, links out.
 *
 * One line, not three tiles. A dashboard of stat cards would be the reflex and
 * it would be wrong twice over: none of these numbers is worth a card, and the
 * cards on this page are supposed to mean "a system you can open".
 */
function Tally({ systems, phases, shared }: { systems: number; phases: number; shared: number }) {
  const parts = [
    { n: systems, one: 'system', many: 'systems' },
    { n: phases, one: 'phase', many: 'phases' },
    // Nothing shared yet is not a zero worth printing.
    ...(shared > 0 ? [{ n: shared, one: 'link out', many: 'links out' }] : []),
  ]
  return (
    <p className="mt-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[13px] text-ink-faint">
      {parts.map((p, i) => (
        <span key={p.one} className="flex items-baseline gap-2.5">
          {i > 0 && <span aria-hidden="true">·</span>}
          <span>
            <span className="font-black tabular-nums text-ink">{p.n}</span>{' '}
            {p.n === 1 ? p.one : p.many}
          </span>
        </span>
      ))}
    </p>
  )
}

function FolderModal({
  currentFolder,
  existingFolders,
  onClose,
  onMove,
}: {
  currentFolder: string
  existingFolders: string[]
  onClose: () => void
  onMove: (folder: string) => void
}) {
  const [draft, setDraft] = useState(currentFolder)

  return (
    <Modal title="Move to folder" onClose={onClose}>
      <div className="flex flex-col gap-4 p-6 pt-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-ink-soft">New or existing folder</span>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onMove(draft.trim())
              }
            }}
            placeholder="e.g. Attacking, Defending..."
            className="w-full rounded-md border border-ink-hair bg-paper px-3 py-2 text-[15px] font-bold text-ink outline-none focus:border-ink/25"
          />
        </label>
        
        {existingFolders.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-ink-soft">Your folders</span>
            <div className="flex flex-wrap gap-2">
              {existingFolders.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setDraft(f)
                    onMove(f)
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${
                    draft.trim() === f
                      ? 'bg-ink text-paper'
                      : 'bg-ink-hair text-ink-soft hover:text-ink'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-ink-hair bg-surface p-4 sm:rounded-b-2xl">
        <Button variant="danger" onClick={() => onMove('')}>
          Remove from folder
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="solid" onClick={() => onMove(draft.trim())}>
            Move
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── one system ───────────────────────────────────────────────────────────────

function Card({
  row,
  onDuplicate,
  onRename,
  onFolderClick,
  onDelete,
}: {
  row: CloudSystem
  onDuplicate: () => void
  onRename: (title: string) => void
  onFolderClick: (current: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.system.title)
  const [confirming, setConfirming] = useState(false)

  // Disarm on its own, like the studio's ConfirmButton does. A half-pressed
  // Delete must not sit armed on a shelf for the rest of the afternoon waiting
  // for somebody to brush it.
  useEffect(() => {
    if (!confirming) return
    const t = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(t)
  }, [confirming])

  const view = viewFor(row.system)
  const first = row.system.acts[0]
  const href = `/studio/new/?s=${encodeURIComponent(row.id)}`
  const phases = row.system.acts.length
  const shareId = row.system.shareId

  // Every board on the page shares one <defs> namespace unless they are told
  // apart, and two boards with the same gradient ids paint each other's colours.
  const idp = useMemo(() => `card-${row.id}`, [row.id])

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-hair bg-surface shadow-paper transition duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <a
        href={href}
        className="block no-underline"
        aria-label={`Open ${row.system.title || 'this system'}`}
      >
        <div className="w-full overflow-hidden bg-paper" style={{ aspectRatio: aspect(view) }}>
          {/* The board leans in a little under the cursor. It is the only
              motion on a card, and it is on the one part of it that is worth
              looking at. */}
          <div className="h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.035]">
            {first && <Board system={row.system} act={resolveAct(first)} idp={idp} />}
          </div>
        </div>
      </a>

      <div className="flex flex-1 flex-col border-t border-ink-hair p-4">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false)
              if (draft !== row.system.title) onRename(draft)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setDraft(row.system.title)
                setEditing(false)
              }
            }}
            maxLength={80}
            className="w-full rounded-md border border-ink-hair bg-paper px-2 py-1 text-[15px] font-bold text-ink outline-none focus:border-ink/25"
          />
        ) : (
          <a
            href={href}
            className="block truncate text-[15px] font-bold leading-tight text-ink no-underline"
          >
            {row.system.title || 'Untitled system'}
          </a>
        )}

        <div className="mt-2.5 flex items-center gap-2.5">
          <Phases n={phases} />
          <span className="text-[12px] text-ink-faint">{when(row.updated)}</span>
          {/* Published, and the link itself. Not an anchor nested inside the
              card's own — it sits outside it, and it goes somewhere else: what
              the people this was sent to are looking at right now. */}
          {shareId && (
            <a
              href={`/s/${shareId}`}
              target="_blank"
              rel="noopener"
              title="Open the link you sent"
              className="ml-auto shrink-0 rounded-full bg-gold/15 px-2.5 py-1 font-mono text-[11px] font-bold text-ink no-underline transition-colors hover:bg-gold/30"
            >
              /s/{shareId}
            </a>
          )}
        </div>

        {/*
          Faint until you go near them, never hidden. They used to be opacity-0
          until hover or focus-within, which reads well on a laptop and leaves a
          coach on a phone with no way to rename anything — a touch screen has
          no hover, and opacity does not take a button out of the tab order
          anyway, so the trade it was making was not one it was getting.
        */}
        <div className="mt-3 flex items-center gap-1 pt-1 text-ink-faint transition-colors group-focus-within:text-ink-soft group-hover:text-ink-soft">
          <Small onClick={() => setEditing(true)}>Rename</Small>
          <Small onClick={() => onFolderClick(row.system.folder || '')}>
            Folder
          </Small>
          <Small onClick={onDuplicate}>Duplicate</Small>
          {confirming ? (
            <Small danger onClick={onDelete}>
              Yes, delete it
            </Small>
          ) : (
            <Small danger onClick={() => setConfirming(true)}>
              Delete
            </Small>
          )}
        </div>
      </div>
    </li>
  )
}

/**
 * How many phases, as the phases themselves.
 *
 * A miniature of the editor's phase strip rather than the words "3 phases": on
 * a shelf of twelve, the length of a system is compared far quicker than it is
 * read, and this is the same row of tiles a coach clicks along inside the
 * studio. The words are still there for anyone who cannot see the tiles.
 */
function Phases({ n }: { n: number }) {
  const shown = Math.min(n, 8)
  return (
    <span className="flex shrink-0 items-center gap-[3px]" title={`${n} phase${n === 1 ? '' : 's'}`}>
      <span className="sr-only">
        {n} phase{n === 1 ? '' : 's'}
      </span>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} aria-hidden="true" className="block h-[11px] w-[5px] rounded-[1.5px] bg-ink/25" />
      ))}
      {n > shown && (
        <span aria-hidden="true" className="ml-0.5 text-[11px] font-bold text-ink-faint">
          +{n - shown}
        </span>
      )}
    </span>
  )
}

function Small({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-[12px] font-bold text-current transition-colors hover:bg-ink-hair ${
        danger ? 'hover:text-[#E2473B]' : 'hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

// ── the way in ───────────────────────────────────────────────────────────────

/**
 * A blank board at the head of the shelf.
 *
 * Same proportions as a card, drawn as a pitch that has not been marked out
 * yet, so the grid reads as boards all the way across instead of as boards with
 * a button stuck on the front.
 */
function NewTile({ onClick }: { onClick: () => void }) {
  return (
    <li className="flex">
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full flex-col overflow-hidden rounded-2xl border border-dashed border-ink-hair text-left transition duration-300 hover:-translate-y-0.5 hover:border-ink/25 hover:bg-surface/60"
      >
        <span className="grid w-full place-items-center" style={{ aspectRatio: CARD_ASPECT }}>
          <span className="grid h-12 w-12 place-items-center rounded-full border border-ink-hair text-ink-faint transition-colors group-hover:border-ink/25 group-hover:text-ink">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </span>
        <span className="w-full flex-1 border-t border-dashed border-ink-hair p-4">
          <span className="block text-[15px] font-bold leading-tight text-ink">New system</span>
          <span className="mt-1.5 block text-[12px] text-ink-faint">
            A pitch, your shape on it, and the first phase.
          </span>
        </span>
      </button>
    </li>
  )
}

// ── the two waits ────────────────────────────────────────────────────────────

/**
 * The shelf, before it has arrived.
 *
 * A line of type saying "Fetching your systems…" tells a coach to wait and
 * shows them nothing. Six card-shaped holes tell them what is coming and stop
 * the page jumping when it does.
 */
function Skeleton() {
  return (
    <>
      <p className="sr-only" role="status">
        Fetching your systems
      </p>
      <ul className="mt-8 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li
            key={i}
            aria-hidden="true"
            className="overflow-hidden rounded-2xl border border-ink-hair bg-surface shadow-paper"
          >
            <div
              className="w-full animate-pulse bg-ink/[0.04]"
              style={{ aspectRatio: CARD_ASPECT }}
            />
            <div className="border-t border-ink-hair p-4">
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-ink/[0.07]" />
              <div className="mt-3 h-2.5 w-1/3 animate-pulse rounded bg-ink/[0.05]" />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * The empty state, which is the most important screen in the portal.
 *
 * A blank shelf with one button is the moment a coach decides whether this is
 * for them, and "New system" alone asks them to invent something on the spot.
 * The second door is the library: we have systems worth opening, and starting
 * from a finished one is how most people learn a tool they did not ask for.
 */
function Empty({ onNew }: { onNew: () => void }) {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-ink-hair px-6 py-16 text-center">
      <h2 className="text-section font-black tracking-display text-ink">Build your first one</h2>
      <p className="mx-auto mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        A system is a board posed phase by phase. Put your shape down, move it to where the ball takes
        it, and the movement between the two comes back as film.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onNew}
          className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-paper transition hover:-translate-y-px hover:shadow-lift"
        >
          Start a new system
        </button>
        {/* Was /library/, which is an article about a system rather than the
            system. It now goes to the five below, which actually open. */}
        <a
          href="#start-from-ours"
          className="rounded-full border border-ink-hair px-6 py-3 text-sm font-bold text-ink no-underline transition-colors hover:border-ink/25 hover:bg-surface/60"
        >
          Start from one of ours
        </a>
      </div>
    </div>
  )
}

function Notice({ tone, children }: { tone: 'green' | 'gold'; children: React.ReactNode }) {
  return (
    <p
      className={`mt-6 rounded-xl border-l-[3px] px-4 py-3 text-[13px] leading-relaxed text-ink ${
        tone === 'green' ? 'border-green bg-green/[0.07]' : 'border-gold bg-gold/[0.09]'
      }`}
    >
      {children}
    </p>
  )
}

function Centre({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5">
      <p className="text-micro uppercase text-ink-faint">{children}</p>
    </div>
  )
}

/**
 * "Today", "Yesterday", then a date.
 *
 * A shelf is read by recency, and "12 August 2026" makes a coach do the
 * subtraction themselves for the two answers they ask for most.
 */
function when(iso: string): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const day = 86_400_000
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const diff = midnight.getTime() - new Date(then).setHours(0, 0, 0, 0)
  if (diff <= 0) return 'today'
  if (diff <= day) return 'yesterday'
  if (diff < 7 * day) return `${Math.round(diff / day)} days ago`
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}
