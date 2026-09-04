/**
 * The two questions a coach has to have answered before they can join in.
 *
 * A name, and a handle. Nothing else — not a bio, not a crest, not a kit.
 *
 * ── WHY THIS IS A MODAL WHEN ../account/ProfileNudge.tsx ARGUES AGAINST ONE ──
 *
 * That file makes a good case and it is about a different job. The nudge is a
 * SUGGESTION on a page a coach came to for another reason, so it docks in the
 * corner, points at the settings link and can be ignored forever. This is a
 * GATE in front of something the coach has just pressed. There is nothing else
 * on the screen for them to get on with, and covering the page is honest: the
 * page is not what they asked for.
 *
 * ── AND WHY IT ASKS RATHER THAN SENDING THEM TO SETTINGS ────────────────────
 *
 * Because the settings page is eight hundred pixels of form and the answer is
 * two fields, and because a coach sent away mid-action does not come back — they
 * arrive at a page about kit patterns and squads, having pressed Publish, and
 * the thread is gone. Two inputs and a button, saved in place, then the thing
 * they actually pressed happens. The link to the full page is still there for
 * the coach who wants the rest of it.
 *
 * IT WRITES ONLY THE TWO FIELDS IT ASKS FOR. `saveProfile` sends a full payload,
 * so it is handed the loaded profile with two values changed — never a fresh
 * object, which would blank a crest, a kit and a bio the coach spent ten minutes
 * on. The same trap ../account/Settings.tsx names at the top of its file.
 */

import { useEffect, useState } from 'react'
import { Button, Modal } from './ui'
import { Mark } from '../viewer/Mark'
import { handleTaken, saveProfile, type Profile } from '../account/cloud'
import { handleFault, normaliseHandle } from '../account/identity'

export function IdentityGate({
  profile,
  owner,
  /** What the coach pressed. Named, so the dialog can say what it is unlocking. */
  intent,
  onDone,
  onClose,
}: {
  profile: Profile
  owner: string
  intent: 'publish' | 'feed'
  onDone: (profile: Profile) => void
  onClose: () => void
}) {
  const [presenter, setPresenter] = useState(profile.presenter)
  const [handle, setHandle] = useState(profile.handle)
  const [fault, setFault] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const save = async () => {
    const name = presenter.trim()
    if (!name) {
      setFault('Your name goes on your work, so it needs to be something.')
      return
    }
    const shape = handleFault(handle)
    if (shape) {
      setFault(shape)
      return
    }
    if (!handle) {
      setFault('Pick a handle. It is the address people visit.')
      return
    }

    setSaving(true)
    setFault('')

    // Asked before the write rather than after the failure: the unique index
    // would refuse this anyway, but "andreas_p is taken, try another" is a
    // sentence and 23505 is not.
    if (await handleTaken(handle, owner)) {
      setSaving(false)
      setFault('Somebody already has that one. Try another.')
      return
    }

    const next: Profile = { ...profile, presenter: name, handle }
    const ok = await saveProfile(next, owner)
    setSaving(false)
    if (!ok) {
      setFault('That did not save. Check your connection and try again.')
      return
    }
    onDone(next)
  }

  return (
    <Modal
      title="Two things first"
      subtitle={
        intent === 'publish'
          ? 'A published system is signed. These are the two fields that sign it.'
          : 'Coaches on here are people with names. These two are all it takes to join them.'
      }
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <a
            href="/studio/settings/"
            className="text-[11px] font-bold text-ink-faint underline underline-offset-4 hover:text-ink"
          >
            Open personal settings
          </a>
          <div className="flex items-center gap-2">
            <Button onClick={onClose}>Not now</Button>
            <Button variant="solid" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving' : 'Save and carry on'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-ink-hair bg-paper p-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink-hair bg-surface">
          <Mark size={20} />
        </span>
        <p className="text-[12px] leading-relaxed text-ink-soft">
          Nothing becomes visible by filling these in. Your profile stays private until you say
          otherwise, and your systems stay private either way.
        </p>
      </div>

      <label className="mb-3 block">
        <span className="mb-1.5 block text-[11px] font-bold text-ink-soft">Your name</span>
        <input
          value={presenter}
          onChange={(e) => setPresenter(e.target.value)}
          placeholder="Who is presenting"
          maxLength={48}
          className="w-full rounded-md border border-ink-hair bg-paper px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-ink-faint"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[11px] font-bold text-ink-soft">Handle</span>
        <div className="flex items-center rounded-md border border-ink-hair bg-paper focus-within:border-ink-faint">
          <span className="pl-2.5 font-mono text-sm text-ink-faint">@</span>
          <input
            value={handle}
            onChange={(e) => setHandle(normaliseHandle(e.target.value))}
            placeholder="andreas_p"
            className="w-full bg-transparent px-1.5 py-1.5 font-mono text-sm text-ink outline-none"
          />
        </div>
        <span className="mt-1.5 block text-[11px] leading-snug text-ink-faint">
          Your address on here. Letters, numbers and single underscores.
        </span>
      </label>

      {fault && <p className="mt-3 text-[12px] font-bold leading-snug text-ink">{fault}</p>}
    </Modal>
  )
}
