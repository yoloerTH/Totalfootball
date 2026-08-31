/**
 * Personal settings: who a coach is, who plays for them, and what their boards
 * look like.
 *
 * This page used to be three fields — the three the share dialog asks for — and
 * that framing is still the first section, because it is still the thing most
 * people come here for. Phase 1 of docs/SOCIAL.md added two more, and a coach's
 * question about player names added a fourth:
 *
 *   · **Your kit**, so a coach's boards start in their colours rather than the
 *     house green, now including the pattern on the shirt,
 *   · **Your squad**, a list of players typed once and picked from thereafter,
 *     and
 *   · **Your profile**, an OPTIONAL public identity.
 *
 * ── THE COACH COMES FIRST, THEN THE THINGS THEY OWN ──────────────────────────
 *
 * **You** — face, name, role, handle, bio, links, and the switch that decides
 * whether any of it is visible. Then **your club**, **your kit** and **your
 * squad**, which are things a coach owns rather than things a coach is.
 *
 * That order is a correction. Personal identity used to be split in two, with a
 * name in the first section and a face, a handle and a bio in the last, six
 * hundred pixels and two unrelated editors apart. One question deserves one
 * answer in one place.
 *
 * Only the first section is ever visible to anyone else. The squad is the
 * strictest of the rest — a different table, a different policy and a private
 * bucket (supabase/013) — and a shared board carries the names a coach typed
 * and never the photographs.
 *
 * ── EVERYTHING NEW IS OFF UNTIL IT IS TURNED ON ──────────────────────────────
 *
 * `visibility` starts private, supabase/012 backfills every existing row
 * private, and the public read policy needs both a handle and 'public' before it
 * will serve anything. A coach who reads this page and closes it has changed
 * nothing about themselves. That is not a default to be tuned later; it is the
 * promise the whole feature was agreed on, and the copy below says so plainly
 * rather than burying it in a toggle's label.
 *
 * The old page's one good idea is kept and extended: SHOW the thing rather than
 * describing it. The credit bar is rendered as it will read, the kit is drawn
 * with the board's own counters, and the profile card is drawn as it will be
 * served. Every one of those is the only way a coach can check their own work.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession, signOut } from './session'
import { EMPTY_PROFILE, handleTaken, saveProfile, type Profile } from './cloud'
import { putProfile, useProfile } from './profile'
import { IMAGE_ACCEPT, bust, imageUrl, removeImage, uploadImage, type ImageKind } from './images'
import { BIO_MAX, LINKS_MAX, ROLES, normaliseHandle, profileFaults } from './identity'
import KitEditor from './KitEditor'
import SquadEditor from './SquadEditor'
import TeamMembers from './TeamMembers'

/**
 * 'unreadable' IS A STATE OF THE PAGE AND NOT OF THE SAVE, and it is new.
 *
 * The read used to be `p ?? EMPTY_PROFILE`, so a request that failed produced
 * exactly the same blank form as an account that has never saved one. The two
 * are not the same at all: this page sends a FULL payload on Save (see
 * `saveProfile`), so pressing it on a form that only looks empty because the
 * fetch fell over overwrites a real, complete row with nothing.
 *
 * So a failed read no longer renders a form. There is nothing safe to do with
 * one. See ./profile.ts for the three answers a read can now give.
 */
type State = 'loading' | 'unreadable' | 'ready' | 'saving' | 'saved' | 'failed'

// ── small pieces, so the page below reads as its own outline ─────────────────

/**
 * The switch, with its own promise written beside it.
 *
 * Extracted because there are now two of them saying opposite-shaped things —
 * one about who may look at a page ABOUT the coach, one about whether the
 * coach's name travels ON their work — and a coach reading the settings page
 * has to be able to tell at a glance that they are two different questions and
 * not one restated. Same control, same weight; the words are what differ.
 */
function Switch({
  on,
  onChange,
  label,
  title,
  children,
}: {
  on: boolean
  onChange: (next: boolean) => void
  /** For a screen reader. The visible `title` changes with the state. */
  label: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-ink">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{children}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${
          on ? 'bg-green' : 'bg-ink-hair'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-surface shadow-paper transition-all ${
            on ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </div>
  )
}


function Section({
  id,
  title,
  note,
  children,
}: {
  /**
   * An anchor, so somewhere else can send a coach to the right part of a long
   * page. The portal's profile prompt does exactly that — it lists three things
   * that are missing and each one lands on the section that owns it, rather
   * than at the top of eight hundred pixels of form (./ProfileNudge.tsx).
   *
   * `scroll-mt` below is what stops the heading arriving flush against the top
   * of the viewport, where it reads as the page having started there.
   */
  id?: string
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="mt-12 scroll-mt-8 border-t border-ink-hair pt-7 first:mt-8 first:border-0 first:pt-0"
    >
      <h2 className="text-micro uppercase text-ink-faint">{title}</h2>
      {note && <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-ink-soft">{note}</p>}
      {children}
    </section>
  )
}

function Fault({ children }: { children?: string }) {
  if (!children) return null
  return <p className="mt-1.5 text-[12px] font-bold leading-snug text-ink">{children}</p>
}

/**
 * Which control a given fault belongs to, and what to call it.
 *
 * ── WHY THIS TABLE EXISTS AT ALL ─────────────────────────────────────────────
 *
 * The Save button used to answer a failed save with "Some of that needs fixing
 * first. The fields are marked above." They WERE marked above — often eight
 * hundred pixels above, past a kit editor, a squad list and a whole profile
 * section — which is a sentence that is true and useless at the same time. A
 * coach reads it, looks at what is on their screen, sees nothing wrong, and
 * concludes the page is broken.
 *
 * So a fault now says what it is and takes you to it. `anchorOf` maps a fault
 * key to the id of the control that owns it — several keys can share one, since
 * every kit fault belongs to the kit editor — and `faultLabel` names it in the
 * words on the page rather than in the words of the schema.
 */
const FAULT_LABEL: Record<string, string> = {
  handle: 'Handle',
  bio: 'Bio',
  crest: 'Club crest',
  avatar: 'Profile picture',
  teamColour: 'Your kit',
  kitRing: 'Trim',
  kitPattern: 'Pattern',
  kitAlt: 'Second colour',
  links: 'Links',
}

function anchorOf(key: string): string {
  if (key.startsWith('link')) return 'links'
  if (key === 'teamColour' || key === 'kitRing' || key === 'kitPattern' || key === 'kitAlt') {
    return 'kit'
  }
  return key
}

function faultLabel(key: string): string {
  if (FAULT_LABEL[key]) return FAULT_LABEL[key]
  // link0 → "Link 1". A coach counts from one.
  const n = /^link(\d+)$/.exec(key)
  return n ? `Link ${Number(n[1]) + 1}` : 'A field above'
}

/** Bring the control a fault belongs to onto the screen. */
function reveal(key: string) {
  const el = document.getElementById(`fault-${anchorOf(key)}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/**
 * Everything wrong, named, in one list, next to the button that refused.
 *
 * Each entry is a button rather than a line of text, because the whole failure
 * this replaces was a coach not being able to FIND the field. Saying "Handle"
 * is better than "above"; taking them to the handle is better than both.
 */
function FaultSummary({ faults }: { faults: Record<string, string> }) {
  const keys = Object.keys(faults)
  if (keys.length === 0) return null
  return (
    <div className="w-full rounded-xl border border-ink-hair bg-paper p-4">
      <p className="text-[13px] font-bold text-ink">
        {keys.length === 1 ? 'One thing needs fixing first.' : `${keys.length} things need fixing first.`}
      </p>
      <ul className="mt-2 space-y-1.5 p-0">
        {keys.map((key) => (
          <li key={key} className="list-none">
            <button
              type="button"
              onClick={() => reveal(key)}
              className="text-left text-[12px] leading-snug text-ink-soft transition-colors hover:text-ink"
            >
              <span className="font-bold text-ink underline underline-offset-4">
                {faultLabel(key)}
              </span>{' '}
              — {faults[key]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const INPUT =
  'mt-1.5 w-full rounded-lg border border-ink-hair bg-surface px-4 py-3 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-ink/30'

/**
 * A picture: the club's badge, or the coach's face.
 *
 * ONE COMPONENT FOR BOTH, because they differ in exactly three ways — what they
 * are called, whether they are drawn square or round, and where the path is
 * stored — and every other line of an upload control is the same line twice.
 * The previous version of this page had that duplication for one picture and it
 * would have had it twice over for two.
 */
function Picture({
  label,
  note,
  url,
  round,
  busy,
  fault,
  anchor,
  onPick,
  onDrop,
}: {
  label: string
  note: string
  url: string
  round?: boolean
  busy: boolean
  fault?: string
  /** Fault key this control owns, so the summary can scroll to it. */
  anchor?: string
  onPick: (file: File | undefined) => void
  onDrop: () => void
}) {
  const shape = round ? 'rounded-full object-cover' : 'rounded-lg object-contain p-1'
  return (
    <div className="mt-4" id={anchor ? `fault-${anchor}` : undefined}>
      <span className="text-[13px] font-bold text-ink">{label}</span>
      <p className="mt-0.5 text-[12px] leading-snug text-ink-faint">{note}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {url ? (
          <img src={url} alt={label} className={`h-14 w-14 border border-ink-hair bg-surface ${shape}`} />
        ) : (
          <div
            className={`flex h-14 w-14 items-center justify-center border border-dashed border-ink-hair text-[10px] font-bold uppercase tracking-micro text-ink-faint ${
              round ? 'rounded-full' : 'rounded-lg'
            }`}
          >
            None
          </div>
        )}
        <label className="cursor-pointer rounded-lg border border-ink-hair px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-ink-hair">
          {busy ? 'Working…' : url ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept={IMAGE_ACCEPT}
            disabled={busy}
            onChange={(e) => {
              onPick(e.target.files?.[0])
              // Cleared so choosing the same file twice fires a change.
              e.target.value = ''
            }}
            className="hidden"
          />
        </label>
        {url && (
          <button
            type="button"
            onClick={onDrop}
            disabled={busy}
            className="text-[12px] font-bold text-ink-faint underline underline-offset-4 hover:text-ink disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
      <Fault>{fault}</Fault>
    </div>
  )
}

function Field({
  label,
  note,
  fault,
  anchor,
  children,
}: {
  label: string
  note?: string
  fault?: string
  /** Fault key this field owns, so the summary can scroll to it. */
  anchor?: string
  children: React.ReactNode
}) {
  return (
    <label className="mt-4 block first:mt-5" id={anchor ? `fault-${anchor}` : undefined}>
      <span className="text-[13px] font-bold text-ink">{label}</span>
      {note && <span className="mt-0.5 block text-[12px] leading-snug text-ink-faint">{note}</span>}
      {children}
      <Fault>{fault}</Fault>
    </label>
  )
}

/**
 * The link, and — when there is not one yet — why not.
 *
 * ── IT READS THE SAVED PROFILE, NEVER THE DRAFT ──────────────────────────────
 *
 * A handle typed into the form above is not a handle until it is in the
 * database, and `/c/<handle>` resolves through the public policy or not at all.
 * Offering the link off the draft would hand a coach an address that 404s for
 * everybody they send it to, which is the exact failure this whole feature
 * exists to avoid. So the panel is driven by what was last loaded or last
 * saved, and it says so plainly when the two have drifted apart.
 *
 * ── BUT SILENCE WAS THE WRONG WAY TO SAY "NOT YET" ───────────────────────────
 *
 * The first version returned `null` for every state but the live one, which
 * meant a coach who switched their profile public and could not save — because
 * some unrelated field was refusing, off-screen — got no link, no button and no
 * explanation. The feature simply appeared not to exist. Every state now says
 * something: no handle, not saved yet, or here it is.
 *
 * `window.location.origin` rather than PUBLIC_SITE_URL, matching how
 * `publishSystem` takes an origin in ../share.ts: on localhost that yields a
 * localhost link, which is the one that actually works while testing.
 */
function ShareProfile({ saved, draft }: { saved: Profile; draft: Profile }) {
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)

  // Feature-detected in an effect, not at render: `navigator.share` does not
  // exist while this component is being prerendered, and on desktop browsers it
  // is missing entirely. A button that does nothing is worse than no button.
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  // Off entirely while the profile is private. That is not a "not yet" worth
  // narrating — the switch right above says so, in those words.
  if (draft.visibility !== 'public') return null

  const live = saved.visibility === 'public' && Boolean(saved.handle)

  if (!live) {
    return (
      <div className="mt-4 border-t border-ink-hair pt-4">
        <p className="text-[13px] font-bold text-ink">Your profile link</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
          {!draft.handle
            ? 'Choose a handle above and press Save. Your link appears here.'
            : `Press Save and your link — ${window.location.origin}/c/${draft.handle} — appears here.`}
        </p>
      </div>
    )
  }

  const url = `${window.location.origin}/c/${saved.handle}`
  const drifted = draft.handle !== saved.handle || draft.visibility !== saved.visibility

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard needs a secure context and a permission. The input below is
      // selectable, so a refusal costs the convenience and not the link.
      setCopied(false)
    }
  }

  const share = async () => {
    try {
      await navigator.share({
        title: [saved.presenter, saved.team].filter(Boolean).join(' · ') || 'Total Football',
        text: 'My profile on Total Football',
        url,
      })
    } catch {
      // Includes the coach simply dismissing the sheet, which is not an error.
    }
  }

  return (
    <div className="mt-4 border-t border-ink-hair pt-4">
      <p className="text-[13px] font-bold text-ink">Share your profile</p>
      <p className="mt-0.5 text-[12px] leading-snug text-ink-faint">
        Anyone with this link can open it. No account needed.
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Your profile link"
          className="min-w-0 flex-1 rounded-lg border border-ink-hair bg-surface px-3 py-2.5 font-mono text-[12px] text-ink-soft outline-none focus:border-ink/30"
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-lg bg-ink px-4 py-2.5 text-[13px] font-bold text-paper transition-opacity hover:opacity-90"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={() => void share()}
            className="shrink-0 rounded-lg border border-ink-hair px-4 py-2.5 text-[13px] font-bold text-ink transition-colors hover:bg-ink-hair"
          >
            Share
          </button>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="shrink-0 text-[12px] font-bold text-ink-faint underline underline-offset-4 hover:text-ink"
        >
          Open
        </a>
      </div>

      {drifted && (
        <p className="mt-2 text-[12px] font-bold leading-snug text-ink">
          You have changed your handle or your privacy since this link was made. Press Save to
          update it.
        </p>
      )}
    </div>
  )
}

// ── the page ─────────────────────────────────────────────────────────────────

export default function Settings() {
  const { status, user } = useSession()
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE)
  const [state, setState] = useState<State>('loading')
  const [faults, setFaults] = useState<Record<string, string>>({})
  /**
   * The profile as the DATABASE currently has it, kept beside the draft.
   *
   * Only the share panel needs this, and it needs it badly: `/c/<handle>`
   * resolves for a saved handle and 404s for a typed one. Updated on load and
   * on a successful save, never on a keystroke.
   */
  const [saved, setSaved] = useState<Profile>(EMPTY_PROFILE)
  /**
   * The pictures' URLs, held separately from their paths on the profile.
   *
   * Because each object is overwritten in place (see ./images.ts), the URL does
   * not change when the image does, and a browser that has cached the old one
   * would go on showing it. `bust()` puts a timestamp on the copies this
   * component shows, and only this component: they must never be stored.
   */
  const [pics, setPics] = useState({ crest: '', avatar: '' })
  /** Which picture is mid-upload, so only that control says so. */
  const [busy, setBusy] = useState<ImageKind | ''>('')

  useEffect(() => {
    if (status !== 'out') return
    window.location.replace('/studio/login/?next=%2Fstudio%2Fsettings%2F')
  }, [status])

  /*
   * Mark the section somebody was SENT to.
   *
   * Three things link into the middle of this page — the portal's prompt, the
   * progress list above, and the unsigned line in the export dialogs — and all
   * of them land on an anchor. The browser scrolls, which is most of the job and
   * not all of it: a coach who arrives two thirds of the way down a long form
   * has no way to tell which of the four headings now on their screen is the one
   * they were sent to, and the field they came for is usually not the first one
   * under it.
   *
   * A ring that fades says which. It is deliberately temporary — a permanent
   * `:target` highlight would still be sitting there in ten minutes marking a
   * trip the coach finished long ago — and it is deliberately not a scroll of
   * its own: the browser has already done that, better, and racing it just moves
   * the page twice.
   *
   * Runs on `state` rather than on mount, because at mount the sections do not
   * exist yet: the page renders a loading view until the profile arrives, so
   * `getElementById` on the first pass finds nothing at all.
   */
  useEffect(() => {
    if (state === 'loading') return
    const id = window.location.hash.slice(1)
    if (!id) return
    const el = document.getElementById(id)
    if (!el) return
    const ring = ['ring-2', 'ring-ink/15', 'rounded-2xl', 'transition-shadow', 'duration-700']
    el.classList.add(...ring)
    const t = setTimeout(() => el.classList.remove(...ring), 2600)
    return () => {
      clearTimeout(t)
      el.classList.remove(...ring)
    }
  }, [state])

  /**
   * The read, through the shared store, so this page and an open studio tab
   * are looking at one copy of one row. See ./profile.ts.
   */
  const read = useProfile(user?.id)

  /**
   * The profile this form was last seeded FROM, by identity.
   *
   * The store publishes to every subscriber, and this page is one of them —
   * including when this page is what published. Without this, `save` would put
   * the new profile in the store, the store would hand it straight back, and
   * the effect below would re-seed and reset `state` to 'ready', wiping the
   * "Saved" the coach had pressed for a tenth of a second earlier.
   *
   * A ref and not a dependency: putting `profile` in the effect's deps would
   * re-run it on every keystroke, and re-seeding the draft from the stored copy
   * mid-sentence would delete what they were typing.
   */
  const seeded = useRef<Profile | null>(null)

  useEffect(() => {
    if (read.status === 'loading') return
    if (read.status === 'error') {
      setState('unreadable')
      return
    }
    // 'none' is a real, safe answer: this account has never saved a profile, so
    // a blank form IS the truth and writing it is an insert. 'row' is the row.
    const next = read.profile ?? EMPTY_PROFILE
    if (seeded.current === next) return
    seeded.current = next
    setProfile(next)
    setSaved(next)
    setPics({ crest: imageUrl(next.crestPath), avatar: imageUrl(next.avatarPath) })
    setState('ready')
  }, [read])

  const set = useCallback((patch: Partial<Profile>) => {
    setProfile((p) => ({ ...p, ...patch }))
    setState('ready')

    /**
     * A field that has just been edited stops being complained about.
     *
     * Not re-validated — that happens on Save, where the network check for a
     * taken handle also lives. Just silenced. Now that the fault summary is a
     * list beside the button rather than one line of text, a stale entry is a
     * coach being told to fix something they are looking at having fixed.
     *
     * Returns `f` UNCHANGED when nothing was dropped. A fresh object on every
     * keystroke would re-render the whole page for each character typed into
     * the bio.
     */
    setFaults((f) => {
      const held = Object.keys(f)
      if (held.length === 0) return f
      const touched = new Set(Object.keys(patch))
      const next = Object.fromEntries(
        Object.entries(f).filter(([key]) => {
          // Editing any link clears every link fault: they are one control.
          if (key === 'links' || key.startsWith('link')) return !touched.has('links')
          // The public-with-no-handle rule reads both fields, so flipping the
          // switch has to clear the complaint it caused.
          if (key === 'handle' && touched.has('visibility')) return false
          return !touched.has(key)
        }),
      )
      return Object.keys(next).length === held.length ? f : next
    })
  }, [])

  const save = useCallback(async () => {
    if (!user) return

    // COLLECT, then decide. One press shows every field that needs fixing
    // rather than making the coach find them one at a time.
    const found = profileFaults(profile)

    // The one check that needs the network, and the one the client cannot be
    // sure of: the unique index in supabase/012 is what actually refuses a
    // duplicate. This only makes the refusal arrive as a sentence instead of a
    // 23505. See `handleTaken` for why it can miss a private holder.
    if (!found.handle && profile.handle) {
      if (await handleTaken(profile.handle, user.id)) {
        found.handle = 'That handle is taken. Try another.'
      }
    }

    setFaults(found)
    if (Object.keys(found).length > 0) {
      setState('ready')
      // Take them to the first one. The summary beside the button names all of
      // them, but the button is at the foot of a long page and the field that
      // refused can easily be off the top of the screen — which is exactly the
      // failure the old "the fields are marked above" produced.
      reveal(Object.keys(found)[0])
      return
    }

    setState('saving')
    const ok = await saveProfile(profile, user.id)
    // The share panel may only offer a link that actually resolves, so the
    // saved snapshot moves forward on success and stays put on failure.
    if (ok) {
      setSaved(profile)
      // Claimed BEFORE it is published, so the echo this page is about to get
      // back from the store is recognised as its own and does not re-seed the
      // form out from under the "Saved" below.
      seeded.current = profile
      // Straight into the shared store, without a round trip to confirm what
      // we just sent. A studio tab left open on another board repaints its kit
      // and its credit from here. See `putProfile`.
      putProfile(profile)
    }
    setState(ok ? 'saved' : 'failed')
  }, [profile, user])

  /**
   * The column each picture writes to. Two entries, and the reason it is a table
   * rather than an `if` is that a third one is coming: the crest, the avatar and
   * — the day a badge is earned — whatever comes after.
   */
  const FIELD = { crest: 'crestPath', avatar: 'avatarPath' } as const

  const onPic = useCallback(
    async (kind: 'crest' | 'avatar', file: File | undefined) => {
      if (!file || !user) return
      setBusy(kind)
      const { path, fault } = await uploadImage(file, user.id, kind)
      setBusy('')
      if (fault) {
        setFaults((f) => ({ ...f, [kind]: fault }))
        return
      }
      setFaults((f) => {
        const { [kind]: _drop, ...rest } = f
        return rest
      })
      set({ [FIELD[kind]]: path })
      setPics((pp) => ({ ...pp, [kind]: bust(imageUrl(path)) }))
    },
    [set, user],
  )

  const dropPic = useCallback(
    async (kind: 'crest' | 'avatar') => {
      const path = profile[FIELD[kind]]
      if (!path) return
      setBusy(kind)
      // Storage first, column second. A profile pointing at a deleted object
      // shows a broken image; a cleared column pointing at a surviving object is
      // a stray 40 KB. Order it so the worse of the two cannot happen. See
      // ./images.ts.
      await removeImage(path)
      setBusy('')
      set({ [FIELD[kind]]: '' })
      setPics((pp) => ({ ...pp, [kind]: '' }))
    },
    [profile, set],
  )

  const signature = useMemo(
    () => [profile.presenter.trim(), profile.team.trim()].filter(Boolean).join(' · '),
    [profile.presenter, profile.team],
  )

  if (status !== 'in' || state === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-micro uppercase text-ink-faint">
          {status === 'out' ? 'Taking you to sign in…' : 'Opening your settings…'}
        </p>
      </div>
    )
  }

  /*
   * NO FORM AT ALL, rather than a blank one with a Save button under it.
   *
   * The one thing this page must never do is offer to write over a profile it
   * could not read. Reloading is the whole of the advice because it is the whole
   * of the fix: the row is on the account and it is fine.
   */
  if (state === 'unreadable') {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20">
        <h1 className="text-title font-black tracking-display text-ink">
          We could not open your settings
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          Your profile is safe on your account. We just could not read it this time, and rather
          than show you an empty form you might save over the top of it, we are showing you this.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full bg-ink px-5 py-2.5 text-[14px] font-bold text-paper"
        >
          Try again
        </button>
        <p className="mt-6 text-[13px] text-ink-faint">
          <a href="/studio/portal/" className="font-bold text-ink-soft">
            ‹ Back to your systems
          </a>
        </p>
      </div>
    )
  }

  const isPublic = profile.visibility === 'public'

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <header className="border-b border-ink-hair pb-6">
        <a
          href="/studio/portal/"
          className="text-[13px] font-bold text-ink-soft no-underline hover:text-ink"
        >
          ‹ Your systems
        </a>
        <h1 className="mt-3 text-title font-black tracking-display text-ink">Personal settings</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Who you are, the club you sign your work with, what your boards are drawn in, and who
          plays for you. Only the first of those can ever be seen by anyone else, and only if you
          say so.
        </p>
      </header>

      {/* ── 1. you ───────────────────────────────────────────────────────

          EVERYTHING PERSONAL IS IN ONE PLACE AND IT IS FIRST. It used to be
          split: a name in "how your work is signed" at the top, a face and a
          handle and a bio in "your profile" at the bottom, with a kit editor and
          a squad list in between. That is two answers to "who am I on here",
          separated by six hundred pixels of something else. The club, the kit
          and the squad are all things a coach OWNS; this section is the coach.
          ─────────────────────────────────────────────────────────────────── */}

      <Section
        id="you"
        title="You"
        note="Who you are, and what you do. This is the only part of this page anybody else can ever see — and only once you turn it on at the foot of the section. Everything below is yours alone."
      >
        {/* The coach's own face, not the club's badge. Both are optional and
            neither implies the other: a badge says which club, a face says which
            person, and a profile showing one in place of the other has answered
            the wrong question. */}
        <Picture
          label="Profile picture"
          note="A photo of you, shown on your profile beside your name. Square works best; it is drawn in a circle."
          url={pics.avatar}
          round
          busy={busy === 'avatar'}
          fault={faults.avatar}
          anchor="avatar"
          onPick={(f) => void onPic('avatar', f)}
          onDrop={() => void dropPic('avatar')}
        />

        <Field label="Your name" note="Goes at the foot of every board you share, so you sign your work once instead of every time.">
          <input
            value={profile.presenter}
            onChange={(e) => set({ presenter: e.target.value })}
            placeholder="Who is presenting"
            maxLength={48}
            className={INPUT}
          />
        </Field>

        <Field label="What you do">
          <select
            value={profile.role}
            onChange={(e) => set({ role: e.target.value })}
            className={INPUT}
          >
            <option value="">Rather not say</option>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Handle"
          note="Your address, if you ever make your profile public. Letters, numbers and underscores."
          fault={faults.handle}
          anchor="handle"
        >
          <div className="mt-1.5 flex items-center rounded-lg border border-ink-hair bg-surface focus-within:border-ink/30">
            <span className="pl-4 font-mono text-[15px] text-ink-faint">@</span>
            <input
              value={profile.handle}
              onChange={(e) => set({ handle: normaliseHandle(e.target.value) })}
              placeholder="andreas_p"
              className="w-full bg-transparent px-2 py-3 font-mono text-[15px] text-ink outline-none placeholder:text-ink-faint"
            />
          </div>
        </Field>

        <Field
          label="Bio"
          note={`${profile.bio.length} of ${BIO_MAX} characters.`}
          fault={faults.bio}
          anchor="bio"
        >
          <textarea
            value={profile.bio}
            onChange={(e) => set({ bio: e.target.value.slice(0, BIO_MAX) })}
            placeholder="What you coach, who you coach, what you are working on."
            rows={3}
            maxLength={BIO_MAX}
            className={`${INPUT} resize-y leading-relaxed`}
          />
        </Field>

        <div className="mt-4" id="fault-links">
          <span className="text-[13px] font-bold text-ink">Links</span>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-faint">
            Up to {LINKS_MAX}. Your club, your channel, wherever your work lives.
          </p>
          <div className="mt-2 space-y-2">
            {profile.links.map((link, i) => (
              <div key={i}>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={link.label}
                    onChange={(e) => {
                      const links = [...profile.links]
                      links[i] = { ...links[i], label: e.target.value }
                      set({ links })
                    }}
                    placeholder="Name"
                    maxLength={32}
                    className="w-32 shrink-0 rounded-lg border border-ink-hair bg-surface px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-ink/30"
                  />
                  <input
                    value={link.url}
                    onChange={(e) => {
                      const links = [...profile.links]
                      links[i] = { ...links[i], url: e.target.value }
                      set({ links })
                    }}
                    placeholder="https://"
                    inputMode="url"
                    className="min-w-0 flex-1 rounded-lg border border-ink-hair bg-surface px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-faint focus:border-ink/30"
                  />
                  <button
                    type="button"
                    onClick={() => set({ links: profile.links.filter((_, j) => j !== i) })}
                    aria-label={`Remove link ${i + 1}`}
                    className="shrink-0 rounded-lg border border-ink-hair px-3 text-sm font-bold text-ink-faint transition-colors hover:bg-ink-hair hover:text-ink"
                  >
                    ×
                  </button>
                </div>
                <Fault>{faults[`link${i}`]}</Fault>
              </div>
            ))}
          </div>
          <Fault>{faults.links}</Fault>
          {profile.links.length < LINKS_MAX && (
            <button
              type="button"
              onClick={() => set({ links: [...profile.links, { label: '', url: '' }] })}
              className="mt-2 text-[12px] font-bold text-ink-faint underline underline-offset-4 hover:text-ink"
            >
              Add a link
            </button>
          )}
        </div>

        {/* The switch, and the whole promise stated next to it rather than in a
            help page nobody opens. */}
        <div className="mt-7 rounded-xl border border-ink-hair bg-paper p-4">
          <Switch
            on={isPublic}
            onChange={(next) => set({ visibility: next ? 'public' : 'private' })}
            label="Make my profile public"
            title={isPublic ? 'Your profile is public' : 'Your profile is private'}
          >
            {isPublic
              ? 'Anyone with the link can see your name, picture, club, crest, role, bio and links. Your systems stay private until you publish one, and your squad is never shown.'
              : 'Nobody can see any of this. Your systems are private either way, and turning this on never publishes one.'}
          </Switch>

          <ShareProfile saved={saved} draft={profile} />
        </div>
      </Section>

      {/* ── 2. the club, and how a board is signed ────────────────────────── */}

      <Section
        id="club"
        title="Your club"
        note="The other half of the credit bar. Your name above is the person; this is the badge beside it."
      >
        <Field label="Club or team">
          <input
            value={profile.team}
            onChange={(e) => set({ team: e.target.value })}
            placeholder="AEL Limassol U16"
            maxLength={48}
            className={INPUT}
          />
        </Field>

        <Picture
          label="Club crest"
          note="PNG, JPG or WebP, up to 5 MB. A square one with a transparent background sits best."
          url={pics.crest}
          busy={busy === 'crest'}
          fault={faults.crest}
          anchor="crest"
          onPick={(f) => void onPic('crest', f)}
          onDrop={() => void dropPic('crest')}
        />

        {/* The credit bar, as it will actually read. Showing it beats describing
            it, and it is the only thing in this section a coach can check. */}
        <div className="mt-7 rounded-xl border border-ink-hair bg-paper p-4">
          <p className="text-micro uppercase text-ink-faint">On every board you share</p>
          <div className="mt-3 flex items-center justify-between gap-4 border-t border-ink-hair pt-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {pics.crest && (
                <img src={pics.crest} alt="" className="h-6 w-6 shrink-0 object-contain" />
              )}
              <p className="truncate text-[12px] font-bold leading-tight text-ink">
                {signature || 'A tactical system'}
              </p>
            </div>
            <span className="shrink-0 text-right text-[10px] font-bold uppercase leading-tight tracking-micro text-ink-soft">
              Made with
              <br />
              Total Football
            </span>
          </div>
        </div>
      </Section>

      {/* ── 3. the kit ────────────────────────────────────────────────────── */}

      <Section
        id="kit"
        title="Your kit"
        note="The colours and the shirt a new system starts in. Systems you have already made keep the kit they were built in — changing this never rewrites old work. To bring a new kit onto a board you have already started, open it and press Use my kit in the Your club panel."
      >
        <div className="mt-5" id="fault-kit">
          <KitEditor
            kit={{
              teamColour: profile.teamColour,
              kitRing: profile.kitRing,
              kitPattern: profile.kitPattern,
              kitAlt: profile.kitAlt,
            }}
            onChange={set}
          />
        </div>
        <Fault>{faults.teamColour ?? faults.kitRing ?? faults.kitPattern ?? faults.kitAlt}</Fault>
      </Section>

      {/* ── 4. the squad ──────────────────────────────────────────────────── */}

      <Section
        id="squad"
        title="Your squad"
        note="Your players, typed once. In the studio, a counter can then take a name, a number and a face in one press instead of three fields. Everything here is yours alone: a board you share carries the names you put on it and never the photographs, which stay in your account."
      >
        {user && <SquadEditor owner={user.id} />}
      </Section>

      <Section id="team" title="Team Members">
        <TeamMembers />
      </Section>

      <hr className="my-12 border-t-2 border-ink-hair" />

      {/* ── 5. what leaves with the work ──────────────────────────────────── */}

      <Section
        id="identity"
        title="Your name on your work"
        note="A different question from the one above. That one is about a page people visit; this one is about the files and links you send them."
      >
        <div className="mt-5 rounded-xl border border-ink-hair bg-paper p-4">
          <Switch
            on={profile.showIdentity}
            onChange={(next) => set({ showIdentity: next })}
            label="Show my details on exports, films and share links"
            title={
              profile.showIdentity
                ? 'Your work is signed'
                : 'Your work goes out unsigned'
            }
          >
            {profile.showIdentity
              ? 'Your name, your club and your crest go on the pictures, films and links you send, and your players are named on the board. This is what a credit line is for, and it is how somebody knows whose work they are looking at.'
              : 'Pictures, films and share links go out with no name, no club, no crest and no player names on the counters. The board itself is untouched: everything is still here, and turning this back on puts it all back.'}
          </Switch>
          <p className="mt-3 border-t border-ink-hair pt-3 text-[12px] leading-relaxed text-ink-faint">
            This is the DEFAULT each export starts on. You can flip it for one picture, one film or
            one link in the dialog itself, without changing it here.
          </p>
        </div>
      </Section>

      {/* ── save ──────────────────────────────────────────────────────────── */}

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-ink-hair pt-6">
        <button
          type="button"
          onClick={() => void save()}
          disabled={state === 'saving'}
          className="rounded-lg bg-ink px-5 py-3 text-sm font-bold text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save'}
        </button>
        {state === 'failed' && (
          <p className="text-[13px] text-ink-soft">
            That did not save. Check your connection and press it again.
          </p>
        )}
        {state !== 'saving' && <FaultSummary faults={faults} />}
      </div>

      {/* ── account ───────────────────────────────────────────────────────── */}

      <Section title="Account">
        <p className="mt-3 text-[14px] text-ink-soft">
          Signed in as <span className="font-bold text-ink">{user?.email ?? 'your account'}</span>.
        </p>
        <button
          type="button"
          onClick={() => void signOut().then(() => window.location.replace('/studio/'))}
          className="mt-4 rounded-lg border border-ink-hair px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-ink-hair"
        >
          Sign out
        </button>
      </Section>
    </div>
  )
}
