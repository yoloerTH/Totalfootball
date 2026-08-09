#!/usr/bin/env bash
#
# Export the phase diagrams for the library.
#
# Two stages, kept apart so the whole thing is re-runnable:
#   1. remotion still  →  media/raw/<slug>/phase-NN.png   (untouched originals)
#   2. postprocess.mjs →  public/library/<slug>/…         (cropped + encoded)
#
# The separation matters: cropping in place is not idempotent, so a second run
# would crop an already-cropped frame. Raw stays raw.
#
#   ./media/export.sh                        # every system in the manifest
#   ./media/export.sh defending-in-a-back-four
#   ./media/export.sh defending-in-a-back-four --skip-render   # re-crop only
#
# NOT GIF. A 3s 720p GIF is 5-15MB and 256 colours; these pages have to pass
# Core Web Vitals. See docs/SPEC.md §6.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(dirname "$HERE")"
MANIFEST="$HERE/manifest.json"

FILTER=""
SKIP_RENDER=0
for arg in "$@"; do
  case "$arg" in
    --skip-render) SKIP_RENDER=1 ;;
    *) FILTER="$arg" ;;
  esac
done

EDITOR_ROOT="$(cd "$WEB_ROOT/$(node -p "require('$MANIFEST').editorRoot")" && pwd)"
RAW_ROOT="$HERE/raw"
SCALE="$(node -p "require('$MANIFEST').scale")"

echo "editor : $EDITOR_ROOT"
echo "raw    : $RAW_ROOT"
echo

if [ "$SKIP_RENDER" -eq 0 ]; then
  node -e "
    const m = require('$MANIFEST');
    const filter = '$FILTER';
    const rows = m.systems
      .filter(s => !filter || s.slug === filter)
      .flatMap(s => s.phases.map(p => [s.slug, s.compId, p.n, p.frame].join('\t')));
    if (!rows.length) { console.error('no systems matched'); process.exit(1); }
    console.log(rows.join('\n'));
  " | while IFS=$'\t' read -r slug compId n frame; do
    pad=$(printf '%02d' "$n")
    dir="$RAW_ROOT/$slug"
    png="$dir/phase-$pad.png"
    mkdir -p "$dir"

    echo "→ $slug  phase $pad  ($compId @ frame $frame)"
    (
      cd "$EDITOR_ROOT"
      npx remotion still src/index.ts "$compId" "$png" \
        --frame="$frame" \
        --scale="$SCALE" \
        --image-format=png \
        --overwrite \
        --log=error
    )
  done
else
  echo "skipping render — re-processing existing raw frames"
fi

echo
echo "cropping and encoding…"
( cd "$WEB_ROOT" && node media/postprocess.mjs ${FILTER:+"$FILTER"} )

echo
echo "done. review public/library/ before committing."
