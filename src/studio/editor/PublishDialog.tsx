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
import { addComment } from '../social/api'
import { forgetVariation, recallVariation } from '../social/variation'

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
  /**
   * The shelf id of the document being published.
   *
   * Only used to look up whether this system was started as a variation of one
   * of ours — see ../social/variation.ts. Optional because the dialog predates
   * it and every caller that has no id is publishing an ordinary system.
   */
  systemId = '',
  profile,
  owner,
  onClose,
}: {
  system: System
  systemId?: string
  profile: Profile
  owner: string
  onClose: () => void
}) {
  const has = useMemo(() => whatItHas(system), [system])

  /**
   * Is this a rework of one of ours?
   *
   * Read once, on mount. It cannot change while the dialog is open, and reading
   * it on every render would make the copy below flicker if the tab's storage
   * were cleared underneath it.
   */
  const vary = useMemo(() => recallVariation(systemId), [systemId])

  const [title, setTitle] = useState(() => suggestedTitle(system))
  const [summary, setSummary] = useState('')
  /*
   * A VARIATION OPENS ON 'public', AND THE CONTROL IS NOT SHOWN.
   *
   * Not a shortcut: the trigger in supabase/032 refuses a variation that is not
   * public, because a thread entry most readers cannot open is worse than no
   * thread entry. Offering the coach a choice we are about to overrule is how a
   * dialog earns an error message it did not need. What the copy owes them
   * instead is the plain sentence that offering it means publishing it, which
   * the note under the composer says before they type anything.
   */
  const [visibility, setVisibility] = useState<PostVisibility>(vary ? 'public' : 'unlisted')
  /** The comment that lands under the official system. Empty is allowed. */
  const [note, setNote] = useState('')
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
  const [done, setDone] = useState<{ url: string; facesMissed: number; missedThread?: boolean } | null>(
    null,
  )
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
      {
        title,
        summary,
        visibility,
        identity,
        media,
        coverAct,
        // Permanent attribution, both ends (docs/SOCIAL.md §5b). Set from the
        // note rather than from anything on the document, so a coach who
        // published this system once already does not silently re-attribute it.
        forkedFrom: vary?.post,
      },
      owner,
    )
    if (isFault(res)) {
      setBusy(false)
      setFault(res.fault)
      return
    }

    /*
     * ── THE COMMENT IS WRITTEN SECOND, AND ITS FAILURE IS NOT THE PUBLISH'S ──
     *
     * The post exists at this point and is the coach's own work; it is on their
     * shelf, on their profile and at its own URL whatever happens next. So a
     * comment that will not write — they lost the network between the two
     * calls, or they have no @handle and reached this dialog from a path that
     * did not gate them — must not be reported as "publishing failed", which
     * would send them to publish it again and leave two copies on the feed.
     *
     * It is said out loud rather than swallowed, because the coach pressed a
     * button that promised their variation would appear under ours.
     */
    let missedThread = false
    if (vary) {
      const body =
        note.trim() ||
        // A variation with no note still has something true to say, and an empty
        // comment is refused by a CHECK on the table.
        `A variation of ${vary.title || 'this system'}.`
      const wrote = await addComment(vary.post, owner, body, res.id)
      missedThread = !wrote.ok
      if (wrote.ok) forgetVariation(systemId)
    }

    setBusy(false)
    setDone({ url: res.url, facesMissed: res.facesMissed, missedThread })
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
        title={vary && !done.missedThread ? 'Offered' : 'It is up'}
        subtitle={
          vary
            ? done.missedThread
              ? 'Your system is published. Getting it into the thread did not go through.'
              : `It is yours, and it is now in the thread under ${vary.title || 'the original'}.`
            : visibility === 'public'
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
        {done.missedThread && (
          /*
           * SAID PLAINLY, AND WITH THE RECOVERY IN IT.
           *
           * The post is up; only the comment failed. The two commonest causes
           * are no @handle (the policy in supabase/032 refuses the insert) and a
           * network that dropped between the two writes, and the same sentence
           * covers both because the same action fixes both: go to the thread and
           * write it. Telling them to publish again would leave two copies of
           * their system on the feed.
           */
          <p className="mb-3 rounded-lg border border-ink-hair bg-paper p-3 text-[12px] leading-relaxed text-ink-soft">
            <span className="font-bold text-ink">Your system is published and is yours.</span> The
            comment under the original did not send — most often because there is no @handle on the
            account yet. Open the thread and post it there; the link below is the one to paste.
          </p>
        )}

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
      title={vary ? 'Offer your variation' : 'Publish this system'}
      subtitle={
        vary
          ? `It goes up as your own system, credited to you, and appears in the thread under ${vary.title || 'the one you started from'}.`
          : 'A snapshot, with its own link. Editing the system afterwards leaves this exactly as it is.'
      }
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] leading-snug text-ink-faint">
            You can change any of this, or take it down, from your shelf.
          </span>
          <div className="flex items-center gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="solid" onClick={() => void publish()} disabled={busy || !title.trim()}>
              {busy ? 'Publishing' : vary ? 'Publish and offer it' : 'Publish'}
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

      {vary && (
        <label className="mb-4 block">
          <span className="mb-1.5 block text-[11px] font-bold text-ink-soft">
            What you changed, for the thread
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 1000))}
            placeholder="What you moved, and what it fixed. One or two sentences is plenty."
            rows={3}
            className={`${INPUT} resize-y leading-relaxed`}
          />
          <span className="mt-1.5 block text-[11px] leading-relaxed text-ink-faint">
            This is the comment that appears under {vary.title || 'the original'}, with your name on
            it. Leave it empty and it says only that you made a variation, which is worth less to
            the next coach reading it.
          </span>
        </label>
      )}

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
      {vary ? (
        /*
         * Stated, not chosen. See the note on `visibility` above: a variation
         * that is not public is a card in a public thread that most of its
         * readers cannot open, and the database refuses it rather than leaving
         * that to the UI. Saying so here is the honest version of a control that
         * would have had one option.
         */
        <p className="rounded-lg border border-ink-hair bg-paper p-3 text-[12px] leading-relaxed text-ink-soft">
          <span className="font-bold text-ink">Anybody, once you offer it.</span> A variation sits in
          a public thread, so it has to be openable by the people reading that thread. If you would
          rather keep this one to yourself, close this and publish it from your shelf as a link-only
          system instead — it simply will not appear under ours.
        </p>
      ) : (
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
      )}

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
