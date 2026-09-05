/**
 * Publishing a system: the title, who can see it, and what of the coach travels
 * with it.
 *
 * ── THIS IS NOT ./ShareDialog.tsx WITH MORE SWITCHES ─────────────────────────
 *
 * A share is a link a coach SENDS to somebody they chose. A post is a thing
 * they PUBLISH, to a feed, under their name, permanently forkable. Two
 * different acts deserve two different dialogs, and the tell is the copy: this
 * one has to say what becomes true about the world, and a share dialog does
 * not. See ../posts.ts for the same distinction stated about the data.
 *
 * The share dialog stays exactly where it is and is still the right tool for
 * Tuesday's session going to an assistant coach.
 *
 * ── THE FOUR TOGGLES ARE THE POINT OF THE DIALOG ─────────────────────────────
 *
 * `showIdentity` (supabase/017) is one switch over everything, which is the
 * right shape for an export and the wrong one here: a coach may well want their
 * name and their badge on a system going to strangers and NOT the eleven names
 * of the under-16s who walked it through on Tuesday. So the parts are separate,
 * they default from the account switch, and the coach can see each one.
 *
 * FACES ARE THE EXCEPTION AND ARE NEVER DEFAULTED ON. A player photograph lives
 * in a private bucket and no shared board has ever shown one (supabase/013).
 * Publishing one copies it somewhere the whole world can read, and that is a
 * decision a coach makes on purpose, with the consequence written next to the
 * switch, once per post. It is never inherited from a setting they ticked in
 * another month.
 *
 * ── AND WHAT IT IS STILL NOT DOING ───────────────────────────────────────────
 *
 * No OG image, no carousel, no PDF. Those are the rest of Phase 2 (§5a) and
 * none of them changes the shape of this dialog: they are formats of the same
 * post. What is here is the whole of the decision a coach makes.
 */

import { useEffect, useMemo, useState } from 'react'
import { Button, Modal, Toggle } from './ui'
import { Mark } from '../viewer/Mark'
import type { Profile } from '../account/cloud'
import { photoPaths } from '../account/squad'
import type { IdentityParts, System } from '../schema'
import {
  POST_SUMMARY_MAX,
  POST_TITLE_MAX,
  defaultIdentity,
  isFault,
  publishPost,
  suggestedTitle,
  type PostVisibility,
} from '../posts'

const INPUT =
  'w-full rounded-md border border-ink-hair bg-paper px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-ink-faint'

/** What the document actually has to offer, so nothing is toggled into thin air. */
function whatItHas(system: System) {
  let names = false
  for (const act of system.acts) {
    for (const token of act.tokens) {
      if (token.name) names = true
    }
  }
  return {
    names,
    faces: photoPaths(system).length,
    crest: Boolean(system.crestUrl),
  }
}

export function PublishDialog({
  system,
  profile,
  owner,
  onClose,
}: {
  system: System
  profile: Profile
  owner: string
  onClose: () => void
}) {
  const has = useMemo(() => whatItHas(system), [system])

  const [title, setTitle] = useState(() => suggestedTitle(system))
  const [summary, setSummary] = useState('')
  const [visibility, setVisibility] = useState<PostVisibility>('unlisted')
  /**
   * How it presents itself, and which phase it opens on.
   *
   * A one-phase system is a still whatever the coach picks, so the choice is
   * only offered when there is something to animate. Multi-phase defaults to
   * playing: a system with six phases is an ARGUMENT, and a still of one of
   * them is a sentence out of the middle of it.
   */
  const [media, setMedia] = useState<'image' | 'video'>(
    system.acts.length > 1 ? 'video' : 'image',
  )
  const [coverAct, setCoverAct] = useState(0)
  const [identity, setIdentity] = useState<IdentityParts>(() =>
    defaultIdentity(profile.showIdentity !== false),
  )
  const [busy, setBusy] = useState(false)
  const [fault, setFault] = useState('')
  const [done, setDone] = useState<{ url: string; facesMissed: number } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const part = (k: keyof IdentityParts) => (v: boolean) => setIdentity((p) => ({ ...p, [k]: v }))

  const publish = async () => {
    setBusy(true)
    setFault('')
    const res = await publishPost(
      system,
      { title, summary, visibility, identity, media, coverAct },
      owner,
    )
    setBusy(false)
    if (isFault(res)) {
      setFault(res.fault)
      return
    }
    setDone({ url: res.url, facesMissed: res.facesMissed })
  }

  const copy = async () => {
    if (!done) return
    try {
      await navigator.clipboard.writeText(done.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  // ── after ──────────────────────────────────────────────────────────────────

  if (done) {
    return (
      <Modal
        title="It is up"
        subtitle={
          visibility === 'public'
            ? 'Anybody can find it. Here is the link to send anyway.'
            : 'Only people you send this to can open it.'
        }
        onClose={onClose}
        footer={
          <div className="flex items-center justify-end gap-2">
            <a
              href={done.url}
              target="_blank"
              rel="noopener"
              className="text-[11px] font-bold text-ink-faint underline underline-offset-4 hover:text-ink"
            >
              Open it
            </a>
            <Button variant="solid" onClick={onClose}>
              Done
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={done.url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Link to your published system"
            className="min-w-0 flex-1 rounded-md border border-ink-hair bg-paper px-2.5 py-1.5 font-mono text-[12px] text-ink-soft outline-none"
          />
          <Button variant="solid" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>

        {/* Said plainly rather than left for a stranger to notice. See
            `PublishResult.facesMissed` in ../posts.ts. */}
        {done.facesMissed > 0 && (
          <p className="mt-3 text-[12px] font-bold leading-snug text-ink">
            {done.facesMissed === 1
              ? 'One photograph could not be published, so that counter has no face on it.'
              : `${done.facesMissed} photographs could not be published, so those counters have no faces on them.`}
          </p>
        )}
      </Modal>
    )
  }

  // ── before ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      title="Publish this system"
      subtitle="A snapshot, with its own link. Editing the system afterwards leaves this exactly as it is."
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] leading-snug text-ink-faint">
            You can change any of this, or take it down, from your shelf.
          </span>
          <div className="flex items-center gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="solid" onClick={() => void publish()} disabled={busy || !title.trim()}>
              {busy ? 'Publishing' : 'Publish'}
            </Button>
          </div>
        </div>
      }
    >
      <label className="mb-3 block">
        <span className="mb-1.5 block text-[11px] font-bold text-ink-soft">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What this system is"
          maxLength={POST_TITLE_MAX}
          className={INPUT}
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-[11px] font-bold text-ink-soft">
          What it is about ({summary.length} of {POST_SUMMARY_MAX})
        </span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value.slice(0, POST_SUMMARY_MAX))}
          placeholder="The problem it solves, and who you built it for."
          rows={3}
          className={`${INPUT} resize-y leading-relaxed`}
        />
      </label>

      {/* ── how it shows up ────────────────────────────────────────────────── */}

      <p className="mb-1.5 text-[11px] font-bold text-ink-soft">How it appears in the feed</p>
      <div className="mb-1.5 flex gap-2">
        {(
          [
            { id: 'video', label: 'It plays', hint: 'The board runs through every phase, at your pace.' },
            { id: 'image', label: 'One still', hint: 'A single phase, held. Best when the shape is the point.' },
          ] as const
        ).map((option) => {
          const on = media === option.id
          const off = option.id === 'video' && system.acts.length < 2
          return (
            <button
              key={option.id}
              type="button"
              disabled={off}
              onClick={() => setMedia(option.id)}
              aria-pressed={on}
              title={off ? 'This system has one phase, so there is nothing to play.' : option.hint}
              className={`flex-1 rounded-lg border p-3 text-left transition-colors disabled:opacity-40 ${
                on ? 'border-ink/30 bg-paper' : 'border-ink-hair hover:bg-paper/60'
              }`}
            >
              <span className="block text-xs font-bold text-ink">{option.label}</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-soft">
                {option.hint}
              </span>
            </button>
          )
        })}
      </div>

      {/* The cover phase. It matters for BOTH kinds — it is the still for one
          and the opening frame for the other — so it is not tucked inside the
          image branch. A coach picking phase 4 has picked the frame that makes
          somebody stop scrolling. */}
      {system.acts.length > 1 && (
        <label className="mb-4 block">
          <span className="text-[11px] font-bold text-ink-soft">
            {media === 'image' ? 'Which phase to show' : 'Which phase it opens on'}
          </span>
          <select
            value={coverAct}
            onChange={(e) => setCoverAct(Number(e.target.value))}
            className={`${INPUT} mt-1.5`}
          >
            {system.acts.map((a, i) => (
              <option key={i} value={i}>
                {i + 1}. {a.title?.trim() || `Phase ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* ── who can see it ─────────────────────────────────────────────────── */}

      <p className="mb-1.5 text-[11px] font-bold text-ink-soft">Who can see it</p>
      <div role="radiogroup" aria-label="Who can see it" className="space-y-2">
        {(
          [
            {
              id: 'unlisted',
              label: 'Link only',
              hint: 'Only people you send the link to. Not in the feed, not in search. The link is seven random characters, so nobody guesses it.',
            },
            {
              id: 'public',
              label: 'Publish to the feed',
              hint: 'Anybody can find it, open it and fork it with credit to you.',
            },
          ] as const
        ).map((option) => {
          const on = option.id === visibility
          return (
            <div
              key={option.id}
              role="radio"
              aria-checked={on}
              tabIndex={0}
              onClick={() => setVisibility(option.id)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  setVisibility(option.id)
                }
              }}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                on ? 'border-ink/30 bg-paper' : 'border-ink-hair hover:bg-paper/60'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${
                  on ? 'border-green bg-green' : 'border-ink-hair'
                }`}
              >
                {on && <span className="h-1.5 w-1.5 rounded-full bg-surface" />}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-ink">{option.label}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-soft">
                  {option.hint}
                </span>
              </span>
            </div>
          )
        })}
      </div>

      {/* ── what travels with it ───────────────────────────────────────────── */}

      <div className="mt-5 rounded-lg border border-ink-hair bg-paper p-3">
        <p className="text-[11px] font-bold text-ink-soft">What goes with it</p>
        <p className="mt-1 mb-2 text-[11px] leading-relaxed text-ink-faint">
          Anything switched off here is not hidden, it is not sent. The tactics always travel:
          counter labels, kit colours, arrows and the session note.
        </p>

        <Toggle
          checked={identity.coach}
          onChange={part('coach')}
          label={`Your name${profile.team ? ` and ${profile.team}` : ' and club'}`}
        />
        <Toggle
          checked={identity.crest}
          onChange={part('crest')}
          label="Your crest"
          disabled={!has.crest}
        />
        <Toggle
          checked={identity.names}
          onChange={part('names')}
          label="Player names"
          disabled={!has.names}
        />
        <Toggle
          checked={identity.faces}
          onChange={part('faces')}
          label="Player photographs"
          disabled={has.faces === 0}
        />

        {has.faces === 0 && (
          <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">
            No player on this board has a photograph on it.
          </p>
        )}

        {/* The consequence, once, at the moment it becomes true — and only then.
            A standing warning that is always on screen is furniture; this one
            appears because the coach just turned something on. */}
        {identity.faces && has.faces > 0 && (
          <p className="mt-2 rounded-md bg-gold/15 p-2.5 text-[11px] font-bold leading-relaxed text-ink">
            {has.faces === 1 ? 'One photograph' : `${has.faces} photographs`} will be copied
            somewhere anybody can open, and will stay there until you take this post down. Player
            photographs are private everywhere else in the studio. If any of them is a child, get
            the consent you would need to put them on a club website.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2.5">
        <Mark size={16} />
        <p className="text-[11px] leading-snug text-ink-faint">
          Our mark is drawn on published work, beside your credit. It is not a switch.
        </p>
      </div>

      {fault && <p className="mt-3 text-[12px] font-bold leading-snug text-ink">{fault}</p>}
    </Modal>
  )
}
