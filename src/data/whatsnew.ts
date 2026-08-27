/**
 * What has changed in the studio, in one place.
 *
 * WHY THIS IS A BUILD-TIME FILE AND NOT A TABLE
 *
 * A changelog is written by us, read by everyone, and never edited by a coach.
 * That is a constant, not data, and putting it in Supabase would buy a network
 * round trip, a loading state and an RLS policy in exchange for the ability to
 * publish an entry without a deploy — which we do not need, because every entry
 * below is about something that only exists after a deploy anyway. Same
 * reasoning as data/faq.ts, which is the file to copy if this one grows.
 *
 * WHY IT IS SEPARATE FROM editor/guide.ts
 *
 * guide.ts is guidance: it explains controls that are on the screen right now,
 * and it is rewritten whenever a control changes. This is a record: an entry is
 * true on the day it is written and stays in the list unchanged after that.
 * Copy that gets edited and copy that must not get edited do not belong in the
 * same file. The panel's own chrome — its heading, its markers — is guidance
 * and lives in guide.ts as `NEWS`.
 *
 * AUTHORING RULES
 *
 *  · Newest first. `unseenNews` reads the order, not the dates, so an entry
 *    inserted in the middle of the list is an entry nobody is told about.
 *  · `id` is authored and permanent, and is never reused. It is the watermark
 *    a coach's "seen up to here" is stored against (`newsSeen` in
 *    studio/storage.ts), so recycling one silently marks unread things read.
 *  · Write it from the coach's side. "Each phase pushes in on whatever that
 *    phase is about" is the entry; "the shot is a box in percent-of-crop" is
 *    the commit message. Nobody reading this cares how it is stored.
 *  · Every entry points at something a coach can go and press. `where` is the
 *    control's real label as it appears in the studio — if you cannot name one,
 *    the change was not coach-facing and does not belong here.
 *  · One change, one entry. Two things bolted together with "and" is two
 *    entries, because this list is scanned rather than read.
 *  · Plain text. It renders as paragraphs, and there is nowhere for a tag to go.
 */

/** How big a change is. Shown as a small marker, so an entry is scannable. */
export type NewsKind = 'new' | 'better' | 'fixed'

export interface NewsEntry {
  /** Permanent, never reused. See the authoring rules. */
  id: string
  /** ISO date, the day it shipped. Displayed, never compared against. */
  date: string
  kind: NewsKind
  title: string
  /** One paragraph. Two or three sentences is the ceiling. */
  body: string
  /** Where to go and press it, named exactly as the studio labels it. */
  where: string
}

/** Newest first. The order is load-bearing — see the authoring rules. */
export const WHATS_NEW: NewsEntry[] = [
  {
    id: 'training-gear',
    date: '2026-08-27',
    kind: 'new',
    title: 'Cones, ladders and mannequins',
    body: 'Nineteen pieces of training kit you can put on the grass: marker cones, hurdles, an agility ladder, mini goals, mannequins, poles and the strength gear. Press one to put it down, drag it where you want it, then size it and turn it. Gear belongs to a phase and moves between phases on Play, so widening a gate is something you show rather than cut to.',
    where: 'Equipment, then Training gear',
  },
  {
    id: 'the-rail-in-drawers',
    date: '2026-08-27',
    kind: 'better',
    title: 'The left-hand panel is in drawers now',
    body: 'Fourteen panels in one column meant scrolling to find the pitch surface, and a control you scroll past is a control nobody finds. They are grouped into six named sections you can open and shut, and the studio remembers which ones you keep open.',
    where: 'The panel down the left',
  },
  {
    id: 'house-colours',
    date: '2026-08-27',
    kind: 'new',
    title: 'A way back from Use my kit',
    body: 'House colours puts our side back to the studio green and takes off the ring, the pattern and the second colour. Undo was the only route to this before, which meant losing everything you had done since.',
    where: 'Your club, then House colours',
  },
  {
    id: 'share-knows-your-name',
    date: '2026-08-27',
    kind: 'fixed',
    title: 'Share stops asking who you are',
    body: 'Boards are signed from your settings now, so Share shows how it will be signed instead of handing you three empty boxes. Sign one differently if you are presenting it for somebody else — it changes that system only.',
    where: 'Share',
  },
  {
    id: 'bigger-headshots',
    date: '2026-08-27',
    kind: 'better',
    title: 'Squad faces are bigger, and no longer cropped',
    body: 'The white ring round a headshot was painted over the edge of the photograph, which is what made the faces feel small and tight in their circle. It sits outside the picture now, and the picture itself is a third larger.',
    where: 'Any counter with a squad photo on it',
  },
  {
    id: 'text-on-the-board',
    date: '2026-08-27',
    kind: 'new',
    title: 'Write anywhere on the board',
    body: 'There is a Text tool in the toolbar now. Click anywhere on the pitch and start typing: a trigger, a coaching point, a name for a space. Set the size, the weight, the colour and how it sits on the grass, turn it to run along a touchline, and drag it wherever it belongs. It goes into the link, the images, the PDF and the film with everything else.',
    where: 'Text',
  },
  {
    id: 'images-export',
    date: '2026-08-27',
    kind: 'new',
    title: 'Save a phase as a picture',
    body: 'PNG files, landscape, square or vertical, of one phase or all of them. Drawn through the same renderer as the film, so a picture is a frame of it. Unlike the video it works in every browser, and it is the thing that actually survives being sent into a group chat.',
    where: 'Export',
  },
  {
    id: 'pdf-from-the-studio',
    date: '2026-08-27',
    kind: 'fixed',
    title: 'The PDF is here, not behind a share link',
    body: 'One phase a page, your notes under each board, a cover with your name on it. It was only reachable by publishing your system and opening your own link; now it is a button in the studio, and Cmd-P works from anywhere on the page. The boards still print as vector, so it stays sharp at any size.',
    where: 'Export',
  },
  {
    id: 'gentler-camera',
    date: '2026-08-27',
    kind: 'better',
    title: 'A calmer camera, and a control for it',
    body: 'Following the ball used to lunge at each phase and back out again. It now leaves far more of the pitch in shot and drifts towards the action instead, and how far it pushes in is yours to set. The frame you drag by hand is easier too: an edge moves the shot, a corner zooms it around its middle rather than sliding it off what you framed.',
    where: 'Camera',
  },
  {
    id: 'faces-you-can-see',
    date: '2026-08-27',
    kind: 'fixed',
    title: 'Player photographs you can actually see',
    body: 'A headshot above a counter was about a third the size of the counter and rimmed in the colour of the pitch it was sitting on, which on a floodlit board meant it was barely there. It is now the full size of the counter with a white rim, on every pitch view and every surface.',
    where: 'Selected player',
  },
  {
    id: 'use-my-kit',
    date: '2026-08-27',
    kind: 'fixed',
    title: 'Bring your kit onto a board you have already started',
    body: 'Your kit from Settings only ever painted a brand new board, so setting or changing it did nothing to the system you were working on. There is a Use my kit button now, and it brings the whole kit across: the colour, the ring, the pattern and its second colour. Your club crest can go in the corner of the board too, on or off per system.',
    where: 'Your club',
  },
  {
    id: 'bent-arrows-bend-the-path',
    date: '2026-08-26',
    kind: 'better',
    title: 'A bowed arrow is now a bowed path',
    body: 'Curl a pass round a defender and the ball takes the curve instead of cutting straight through it. Bend a run, a carry or a press and the player does the same. The board was already drawing the bow; now Play and the exported film agree with it.',
    where: 'Bend',
  },
  {
    id: 'arrows-do-the-move',
    date: '2026-08-26',
    kind: 'new',
    title: 'Let the arrow make the move for you',
    body: 'Pick Pass, tap the passer, tap who receives it, and the studio draws the arrow and puts the ball on the receiver in the next phase. Run, Carry, Press and Switch all work the same way. Do several in a row and they land on the same transition, so a pass, the overlap it releases and the press it beats stay one beat of football rather than three. Everything it poses is still yours to drag afterwards.',
    where: 'Pass, Run, Carry, Press, Switch',
  },
  {
    id: 'arrows-follow-players',
    date: '2026-08-26',
    kind: 'better',
    title: 'Arrows follow the players they are about',
    body: 'Draw an arrow between two counters and it takes hold of them. Move either one, in this phase or the next, and the arrow goes with them instead of staying behind on the grass it was drawn over. An end dropped on open pitch stays on the pitch, which is what you want for a ball played into space.',
    where: 'Pass, Run, Carry, Press, Switch',
  },
  {
    id: 'arrows-adjustable',
    date: '2026-08-26',
    kind: 'better',
    title: 'Adjust an arrow after you have drawn it',
    body: 'Select an arrow and it gets handles: one on each end, one in the middle. Drag an end onto a different counter or off onto the grass, drag the middle to bow it, or drag the line itself to move the whole thing. Redrawing an arrow because it landed two metres short is over.',
    where: 'Move',
  },
  {
    id: 'move-speed',
    date: '2026-08-26',
    kind: 'new',
    title: 'Slow the move down',
    body: 'How long the players and the ball take to travel between phases is now yours to set, separately from how long each phase stands still. Slowing it also spreads the movement evenly across the beat instead of covering most of the ground in the first instant, so a move you are teaching can be followed rather than just seen to have happened.',
    where: 'Pace',
  },
  {
    id: 'block-shades-around-them',
    date: '2026-08-22',
    kind: 'fixed',
    title: 'A block can close around its players',
    body: 'A block you draw yourself used to shade everything between those players and your own goal, which is right for a back four and wrong for everyone else. Pick a front three pressing and it flooded the pitch back to your keeper. It now closes around the players themselves when they are not the deepest line, and Shades lets you say which you meant, on the board, before you draw it.',
    where: 'Draw a block, then Shades',
  },
  {
    id: 'areas-nine-colours',
    date: '2026-08-22',
    kind: 'better',
    title: 'Nine colours, and control of the line',
    body: 'Violet, orange, teal and pink join the five, so four areas on one board can be told apart without reusing red on something that is not danger. Every shaded area can also be solid, dashed or drawn with no outline at all, filled in or left as an outline over the grass, and a block can set how thick the line through its players runs, or turn it off.',
    where: 'Click any shaded area',
  },
  {
    id: 'draw-your-own-block',
    date: '2026-08-21',
    kind: 'new',
    title: 'Draw a block round any players you like',
    body: 'Our block finds your deepest line and shades the space behind it, and that is still there. Draw a block is the other half: pick the players yourself, in the order they stand, and it threads the same line through them. Use it for a midfield screen, a front two pressing together, or any line the automatic one will not find. It stays tied to those players, so it moves when they do.',
    where: 'Shaded areas, on the left',
  },
  {
    id: 'shaded-areas-your-way',
    date: '2026-08-21',
    kind: 'better',
    title: 'Shaded areas you can move, recolour and name',
    body: 'A danger area used to be drawn once and then only deleted. Now click one and it grows handles: drag inside it to move it, take a gold corner to resize it. You can also write a few words into it, pick its colour from the five the boards use, set how heavily it is laid down, and make it a rounded box or an oval instead of a rectangle.',
    where: 'Click any shaded area, then look right',
  },
  {
    id: 'video-quality',
    date: '2026-08-21',
    kind: 'new',
    title: '720p, and 60 frames a second',
    body: 'Films came out at one size and one rate. Now you choose: 1080p to project or upload, 720p when you want it now and it is going into a group chat. And 60fps for the systems with long slow movements, where 30 can judder on a phone. The dialog says what each combination costs you in waiting before you press it.',
    where: 'Video, under the shape',
  },
  {
    id: 'frame-by-hand',
    date: '2026-08-19',
    kind: 'new',
    title: 'Move the camera box yourself',
    body: 'The camera works out what each phase is about and frames it, and it is right most of the time. When it is not, the dashed gold box is now yours to move: drag it to slide the shot, drag a corner to go tighter or wider. It is per phase, so one awkward phase does not cost you the automatic framing on the rest, and there is a button to hand any phase back.',
    where: 'The Camera panel, with Follow the ball on',
  },
  {
    id: 'start-from-ours',
    date: '2026-08-19',
    kind: 'new',
    title: 'Five systems of ours you can open',
    body: 'The False Nine, the third man run, overload to isolate, beating a two-man press, and why a line steps up. They are the boards the films are made on, not pictures of them, so you can open one and move the players yourself. What you open is yours from that moment: rename it, rewrite the words, keep the half you want and throw the rest away. It does not touch ours.',
    where: 'Below your systems, on your systems page',
  },
  {
    id: 'phase-pace',
    date: '2026-08-19',
    kind: 'new',
    title: 'Set how long each phase holds',
    body: 'A system you already know plays too slowly, and until now every one of them held for the same two and a half seconds. Now you set it, from a second and a bit up to six, and the whole thing follows: the film you save, the link you send, and Play. The move between phases is left alone — that is the part carrying the football, and shortening it only makes the game harder to follow.',
    where: 'The Pace panel, and inside Video',
  },
  {
    id: 'camera-follow',
    date: '2026-08-19',
    kind: 'new',
    title: 'The camera can follow the ball',
    body: 'Your film no longer sits still and shows the whole pitch for the whole run. Each phase pushes in on whatever that phase is actually about — the ball, the arrows you drew, anyone you gave a role to — and travels between them, the way the videos are shot. Nothing on the board moves: while you are posing you still see everyone, with the shot drawn over the top as a gold outline so you know what will make the cut.',
    where: 'The Camera panel',
  },
  {
    id: 'theme-swatches',
    date: '2026-08-19',
    kind: 'better',
    title: 'The theme buttons show the room',
    body: 'The four buttons that change the room you work in used to be four coloured diagonals, and the two pitch ones were near enough identical. Each is now a small picture of its own room, mown where that room is mown, so you can pick the one you want without trying each of them.',
    where: 'The theme button, top right',
  },
  {
    id: 'pitch-surfaces',
    date: '2026-08-16',
    kind: 'new',
    title: 'Four pitches to draw on',
    body: 'Paper, Broadcast, Night and Chalk. The whole board changes with the pitch and not just the grass, so an arrow that read well on paper still reads well on green. It is stored on the system, so it travels: everyone you send the link to sees the pitch you chose, and so does the video and the print-out.',
    where: 'The Pitch panel',
  },
  {
    id: 'video-file',
    date: '2026-08-13',
    kind: 'new',
    title: 'Save it as a video',
    body: 'A film of your phases in order, shot on the pitch itself with your captions over it, for the places a link will not go — a story, a status, a group chat that flattens whatever you send it. It is made on your own machine, so nothing is uploaded and nobody waits in a queue.',
    where: 'The Video button, top right',
  },
  {
    id: 'short-links',
    date: '2026-08-13',
    kind: 'new',
    title: 'A link short enough to send',
    body: 'Sharing gives you seven characters after the slash instead of two thousand, so it survives being pasted into a message. The link stays the same one for good: change your system, press Share again, and everyone you already sent it to sees the new version.',
    where: 'The Share button, top right',
  },
  {
    id: 'phone',
    date: '2026-08-12',
    kind: 'better',
    title: 'It opens on a phone',
    body: 'The studio is still a better tool on a laptop and it will say so once, but it no longer turns you away. The board, the phases and Play all work on a phone, which is the half of it you want when you are standing on a touchline showing somebody what you built.',
    where: 'Anywhere — open the studio on your phone',
  },
]

/**
 * The watermark a coach who has seen everything carries.
 *
 * Also what a brand-new coach is given the moment they finish the walkthrough:
 * somebody on their first ever visit has no "since you were last here", and
 * handing them a list of six things they have never not had is a worse welcome
 * than handing them nothing.
 */
export const NEWEST_NEWS_ID: string = WHATS_NEW[0]?.id ?? ''

/**
 * What this coach has not been shown yet, newest first.
 *
 * `seen` is the id of the newest entry they have already had in front of them.
 * Empty means they have never opened the panel — every entry is unseen, which
 * is right for a coach who has been using the studio since before this existed.
 *
 * An id that is not in the list any more means an entry was deleted despite the
 * rule against it. That leaves us unable to tell where the coach had got to, so
 * this treats them as caught up: showing somebody a badge for six things they
 * read last week is a worse failure than staying quiet about one.
 */
export function unseenNews(seen: string): NewsEntry[] {
  if (!seen) return WHATS_NEW
  const i = WHATS_NEW.findIndex((e) => e.id === seen)
  return i < 0 ? [] : WHATS_NEW.slice(0, i)
}
