/**
 * The room, inside the studio.
 *
 * The site already has this — a picker in Header.astro that sets `data-theme`
 * on <html> and remembers it under `tf_theme`, with an inline script in
 * BaseLayout.astro applying it before first paint so a night reader never gets
 * flashed a white page. The studio renders `bare`, without that header, which
 * is the only reason it had none: a coach who had chosen dark everywhere else
 * arrived at the one page on the site that could not honour it.
 *
 * So this is the same mechanism, not a second one. Same attribute, same storage
 * key, same theme-colour meta, same list in ../../lib/theme.ts, so switching
 * here and switching on the library page are the same switch.
 *
 * ── AND IT IS THE ONE THING THE STUDIO STILL PUTS IN THE BROWSER ─────────────
 *
 * Every other piece of studio state moved to the account on 2026-09-06 (see
 * ../storage.ts). This did not, and the reason is that it is not studio state:
 * `tf_theme` belongs to a VISITOR, not to a coach. It has to be readable by the
 * inline script in BaseLayout.astro BEFORE first paint or a night reader is
 * flashed a white page, it has to work on every marketing page where nobody is
 * signed in, and neither of those can wait on a network round trip to a row
 * that may not exist. A per-viewer display setting for an anonymous reader is
 * exactly what a browser key is for.
 *
 * THIS IS THE ROOM, NOT THE BOARD. There are two pitch themes in the list and
 * neither of them touches the pitch — what the board is drawn on is a property
 * of the document, chosen under "Pitch" in the side panel, and it stays put
 * whichever room the coach is sitting in. That is not an oversight; see
 * ../board/surfaces.ts. A board that followed the viewer would mean a coach
 * could not tell what they were about to hand to a room full of players.
 */

import { useEffect, useRef, useState } from 'react'
import { THEMES, resolveTheme, themeSwatch, THEME_STORAGE_KEY, type ThemeId } from '../../lib/theme'
import { HINT } from './guide'
import { Button } from './ui'

function currentId(): ThemeId {
  if (typeof document === 'undefined') return 'light'
  return resolveTheme(document.documentElement.getAttribute('data-theme')).id
}

export function ThemeToggle() {
  // Read after mount rather than in the initial state: this island is
  // `client:only`, but the attribute is set by the inline script in the
  // document head, and reading it during the first render of a component that
  // may be hydrated twice is a hydration mismatch waiting to be introduced.
  const [id, setId] = useState<ThemeId>('light')
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => setId(currentId()), [])

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const apply = (next: ThemeId) => {
    const root = document.documentElement
    // Light is the ABSENCE of the attribute, not a value of it.
    if (next === 'light') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Private mode. The theme still applies for this session.
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolveTheme(next).paper)
    setId(next)
    setOpen(false)
  }

  const theme = resolveTheme(id)

  return (
    <div className="relative" ref={box}>
      {/*
       * No Tip on this one, and that is on purpose: a hover tooltip and a menu
       * opened by the same button land on top of each other, and the tooltip
       * wins — it covered the first two themes. The explanation lives at the
       * foot of the menu instead, where it is read at the moment it is needed.
       */}
      <Button
        onClick={() => setOpen((o) => !o)}
        className="!px-2"
        title={`Room: ${theme.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Room: ${theme.label}`}
      >
        <span
          className="h-4 w-4 rounded-full border border-ink-hair"
          style={{ background: themeSwatch(theme) }}
          aria-hidden="true"
        />
      </Button>

      {open && (
        <div
          role="menu"
          aria-label="Theme"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-ink-hair bg-surface p-1.5 shadow-lift"
        >
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={t.id === id}
              onClick={() => apply(t.id)}
              className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-paper"
            >
              <span
                className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-ink-hair"
                style={{ background: themeSwatch(t) }}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-[12px] font-bold text-ink">{t.label}</span>
                <span className="block text-[11px] leading-snug text-ink-faint">{t.hint}</span>
              </span>
              {t.id === id && (
                <svg
                  className="ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-ink"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 10.5 8 14.5 16 6" />
                </svg>
              )}
            </button>
          ))}
          <p className="border-t border-ink-hair px-2 pb-1 pt-2 text-[11px] leading-snug text-ink-faint">
            {HINT.theme}
          </p>
        </div>
      )}
    </div>
  )
}
