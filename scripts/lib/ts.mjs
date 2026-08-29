/**
 * Let a check script import the studio's own TypeScript.
 *
 * Node 24 strips the types out of a `.ts` file on its own; what it will not do
 * is guess the extension, and every import in `src/` is written without one
 * because that is what the bundler wants. So this adds the guess back, and
 * nothing else.
 *
 * WHY IT MATTERS THAT A CHECK IMPORTS THE REAL FILE: the alternative is a
 * script carrying its own copy of the geometry, which passes forever after the
 * source it was meant to be checking has changed underneath it.
 *
 * Used as `node --import ./scripts/lib/ts.mjs <script>`. Only `.ts` — a `.tsx`
 * still has JSX in it and Node will not strip that.
 */
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      for (const ext of ['.ts', '/index.ts']) {
        const url = new URL(specifier + ext, context.parentURL)
        if (existsSync(fileURLToPath(url))) return next(specifier + ext, context)
      }
    }
    return next(specifier, context)
  },
})
