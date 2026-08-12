/**
 * Day / night, inside the studio.
 *
 * The site already has this — a button in Header.astro that sets `data-theme`
 * on <html> and remembers it under `tf_theme`, with an inline script in
 * BaseLayout.astro applying it before first paint so a night reader never gets
 * flashed a white page. The studio renders `bare`, without that header, which
 * is the only reason it had no toggle: a coach who had chosen dark everywhere
 * else arrived at the one page on the site that could not honour it.
 *
 * So this is the same mechanism, not a second one. Same attribute, same storage
 * key, same theme-colour meta update, so switching here and switching on the
 * library page are the same switch and neither surprises the other.
 *
 * THE BOARD STAYS ON PAPER IN BOTH. That is not an oversight — see
 * ../board/palette.ts. The paper stage is the brand and it is what an exported
 * deck has to look like, so night mode is a property of the room, not of the
 * diagram. A board that inverted itself would mean a coach could not tell what
 * they were about to hand to a room full of players.
 */

import { useEffect, useState } from 'react'
import { Tip } from './Tip'
import { HINT } from './guide'
import { Button } from './ui'

function isDark(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute('data-theme') === 'dark'
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  // Read after mount rather than in the initial state: this island is
  // `client:only`, but the attribute is set by the inline script in the
  // document head, and reading it during the first render of a component that
  // may be hydrated twice is a hydration mismatch waiting to be introduced.
  useEffect(() => setDark(isDark()), [])

  const toggle = () => {
    const next = !isDark()
    const root = document.documentElement
    if (next) root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
    try {
      localStorage.setItem('tf_theme', next ? 'dark' : 'light')
    } catch {
      // Private mode. The theme still applies for this session.
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next ? '#0A0C0B' : '#F4F4F2')
    setDark(next)
  }

  return (
    <Tip text={HINT.theme} title={dark ? 'Day mode' : 'Night mode'} side="bottom">
      <Button
        onClick={toggle}
        className="!px-2"
        aria-label={dark ? 'Switch to day mode' : 'Switch to night mode'}
      >
        {dark ? (
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <circle cx="10" cy="10" r="3.6" />
            <path
              d="M10 2.4v1.8M10 15.8v1.8M2.4 10h1.8M15.8 10h1.8M4.6 4.6l1.3 1.3M14.1 14.1l1.3 1.3M15.4 4.6l-1.3 1.3M5.9 14.1l-1.3 1.3"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path
              d="M16.3 12.4A6.9 6.9 0 0 1 7.6 3.7a6.9 6.9 0 1 0 8.7 8.7Z"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </Button>
    </Tip>
  )
}
