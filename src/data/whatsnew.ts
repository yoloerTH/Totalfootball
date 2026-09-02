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
  /** Optional button text for a custom call to action (e.g. 'Read the guide'). */
  ctaText?: string
  /** Optional href (starts with /) or event name for the CTA. */
  ctaAction?: string
}

/** Newest first. The order is load-bearing — see the authoring rules. */
export const WHATS_NEW: NewsEntry[] = [
  {
    id: 'track-reference-ball',
    date: '2026-09-02',
    kind: 'new',
    title: 'Choose which ball the camera tracks',
    body: 'When you have multiple match balls on the pitch, you can now choose exactly which one the camera should follow. Select a ball and press Track this ball to make it the reference ball. The camera will stay on it through the phases until you choose another.',
    where: 'Track this ball, in the Players panel with a ball selected',
  },
  {
    id: 'sequence-place-mirror',
    date: '2026-09-02',
    kind: 'better',
    title: 'Drop a sequence anywhere, on either flank',
    body: 'Applying a saved sequence no longer disturbs the board you drop it on. It arrives as its own counters, with everything already on the phase left exactly where it is, and it lands selected so you can drag it straight to the patch of grass you want. There are two mirrors as well: swap flanks to run the same pattern down the other side, or swap ends to turn it round.',
    where: 'Apply, on a sequence in My Sequences',
  },
  {
    id: 'view-switch-marks',
    date: '2026-09-02',
    kind: 'fixed',
    title: 'Cones and labels stay put when you change pitch view',
    body: 'Switching between pitch views used to move your equipment, your written notes and any camera frame you had drawn, while moving the players correctly. They now all stay on the grass you put them on, on every view.',
    where: 'The board, in the pitch view picker',
  },
  {
    id: 'pace-mode-linear',
    date: '2026-09-01',
    kind: 'new',
    title: 'Linear movement option for player pace',
    body: 'You can now choose whether players and the ball move across the pitch in a smooth curve or in a straightforward, linear motion. While the standard curve gives a natural fast-start, slow-settle feel, the linear mode keeps the movement steady throughout the phase. Perfect for when you need a constant, predictable speed to teach timing.',
    where: 'The Pace panel',
  },
  {
    id: 'team-collaboration',
    date: '2026-08-31',
    kind: 'new',
    title: 'Work together with your coaching staff',
    body: 'You can now invite other coaches to view or edit your entire collection, or collaborate on a specific system directly. When they accept, they get instant access straight from their dashboard. You decide exactly what they can see or edit, from boards to sequences. Say goodbye to taking screenshots for your assistants.',
    where: 'Team Members in Personal Settings, or the Collaborators button up top',
    ctaText: 'Manage your team',
    ctaAction: '/studio/settings',
  },
  {
    id: 'save-sequence',
    date: '2026-08-31',
    kind: 'new',
    title: 'Create and reuse your own sequences',
    body: 'The Repeat tool has become the new Create Sequence feature! You can now capture any phase sequence and save it into your own private library. Pick the exact area of the pitch or just grab the whole movement, and inject it into any other system whenever you need it. Everything from players to equipment and zones is perfectly preserved.',
    where: 'Create Sequence, on the phase strip, or Sequences in the sidebar',
    ctaText: 'Read the guide',
    ctaAction: 'start-guide-save-sequence',
  },
  {
    id: 'carry-gear',
    date: '2026-08-31',
    kind: 'new',
    title: 'Equipment, zones, and lines carry forward to the next phases',
    body: 'Just like players, when you move or resize a cone, a goal, a shaded zone, or a line you\'ve drawn, that change now automatically carries forward through the rest of the drill. You no longer have to fix the same item on every single phase after moving it once.',
    where: 'Move tool, drag or resize items',
  },
  {
    id: 'manual-camera',
    date: '2026-08-31',
    kind: 'new',
    title: 'Frame the shot yourself with Manual camera',
    body: 'A new Manual camera mode lets you frame the drill exactly how you want it, and it stays exactly there. It will not automatically pan or follow the ball, giving you complete control over what is visible on each phase.',
    where: 'The Camera panel, choose Manual',
  },
  {
    id: 'clone-selection',
    date: '2026-08-31',
    kind: 'new',
    title: 'Duplicate multiple players and equipment at once',
    body: 'You can now select multiple items on the board by dragging a box over them with the Move tool. Once selected, a single press duplicates them all together, keeping their layout intact. Perfect for mirroring a drill to the other side of the pitch without dragging players one by one.',
    where: 'Move tool, drag on the grass',
  },
  {
    id: 'lineup-panel',
    date: '2026-08-29',
    kind: 'new',
    title: 'Change the lineup once, not on every slide',
    body: 'Lineup lists every role on your board with the player filling it, and picking a new one changes the name, the number and the face on every phase at once. Nobody moves: the runs, the timing and the shape stay exactly as you drew them. Build a move properly once and put a different eleven into it next week in a few seconds. It also flags what is easy to miss on a long board, telling you a role nobody is on, the same player in two places, and any phase that disagrees with the others about who somebody is.',
    where: 'Lineup, under Teams and kit',
  },
  {
    id: 'session-grid',
    date: '2026-08-29',
    kind: 'new',
    title: 'Adjustable training grid sizes',
    body: 'You can now set the exact size of your training grid using sliders or presets. Choose from small 10x10 rondos up to full 11v11 pitches. As you resize the grid, the app calculates the space per player to help you plan properly. We left the goals off by default—just drag mini goals from the Equipment menu and place them wherever your drill needs them.',
    where: 'Size of the grid, under The board',
  },
  {
    id: 'session-bench',
    date: '2026-08-29',
    kind: 'fixed',
    title: 'Players no longer squash together on smaller grids',
    body: 'Previously, moving from a full pitch to a small grid would cram all your players together. Now, your players are moved to a waiting area under the grid. You can drag only the players you need onto the grass for your drill, and swap them out as needed. Use the undo button to quickly restore your original match layout.',
    where: 'Pitch view, under The board',
  },
  {
    id: 'session-counters',
    date: '2026-08-29',
    kind: 'fixed',
    title: 'Player sizes scale automatically',
    body: 'Player counters now automatically scale to fit the size of your grid. Before, they stayed the same size, making small grids look overcrowded. Now, a player looks proportional whether they are on a 20x20 rondo or a full pitch. You can still use the size slider to adjust them exactly to your liking.',
    where: 'Anywhere on a session board',
  },
  {
    id: 'align-snap',
    date: '2026-08-29',
    kind: 'better',
    title: 'Players and gear line up as you drop them',
    body: 'Drag a player, the ball, a mannequin or a cone near the line of something already on the board and it comes level with it, with a guide showing you the line it took. A back four is now actually level, three mannequins actually make a line, and a row of cones actually sits in one channel, instead of being a metre out in a way you only see on the finished film. The two axes are decided separately, so a man can come level with his centre-half without moving up the pitch. It never lands anybody on top of anybody. Hold Alt while you drag to turn it off and place something exactly where your hand is.',
    where: 'Anywhere you drag on the board',
  },
  {
    id: 'set-pieces',
    date: '2026-08-29',
    kind: 'new',
    title: 'A board for corners and free kicks',
    body: 'Set pieces stands the pitch on its end with the goal the ball is going into at the top, which is how a dead ball is drawn on every whiteboard in the game, and puts everybody on their marks. There are five to start from: the in-swinging corner, the short corner, defending a corner zonally, a wide free kick delivered, and defending one with a wall at the regulation nine metres. It moves the players you already have rather than giving you strangers, so the names, the faces and the bibs come with them. Two boards, one attacking and one defending, and everything on them is yours to drag.',
    where: 'Set pieces, under The board',
  },
  {
    id: 'bibs',
    date: '2026-08-28',
    kind: 'new',
    title: 'Players can wear bibs',
    body: 'A bib is a colour you can put on any player, on either side, over whatever their team is drawn in. Add one under Teams and kit and it appears as a swatch on every player you select. It is for the sessions that are not two teams: three-colour training, seven against seven plus seven, a group of neutrals, or a keeper who should not be in the outfield shirt. The plus beside the swatches makes a bib in a colour of your own and puts that player straight in it, so colouring one man is one gesture. A bib holds across every phase and travels into films, PDFs and share links.',
    where: 'Bibs, under Teams and kit',
  },
  {
    id: 'shape-scope',
    date: '2026-08-28',
    kind: 'better',
    title: 'Changing shape asks before it moves anybody',
    body: 'Picking a new formation re-places everyone on their formation positions, which used to happen silently and only on the phase you were looking at. Now it tells you which phases have positions you posed by hand, and lets you choose whether the new shape lands on this phase alone or on every one of them. Names, faces, cues, fades and bibs survive the change, which they did not before.',
    where: 'Our shape, under Teams and kit',
  },
  {
    id: 'pitch-grid',
    date: '2026-08-28',
    kind: 'new',
    title: 'The pitch can come already marked up',
    body: 'Markings rules your grid onto the pitch itself: thirds, the five channels, or the eighteen numbered zones. The lines are drawn at the real numbers rather than by eye, so the wide channels end where the penalty area ends and the middle one is the width of the six-yard box. They sit under everything, they are on every phase and every export, and there is nothing to drag or delete. Put your own names on the sectors with the Text tool.',
    where: 'Markings, under The board',
  },
  {
    id: 'band-hatch',
    date: '2026-08-28',
    kind: 'new',
    title: 'A shaded area can be hatched instead',
    body: 'Hatched is a new choice under Inside. It rules the area diagonally instead of washing it, in the same ink and at the same strength, so the grass and the players standing on it still show through. It is the treatment for a channel you want crossed or a space you want left empty, and unlike a wash it survives being printed in black and white.',
    where: 'Inside, on a shaded area',
  },
  {
    id: 'shift-straight',
    date: '2026-08-28',
    kind: 'better',
    title: 'Hold Shift and the line comes out straight',
    body: 'Hold Shift while you drag an arrow or a line and it snaps to straight across, straight along, or a true diagonal. Hold it while you drag a shaded area and the area comes out square. The preview shows it as you pull, so what you let go of is what you get. Rule a grid of corridors this way and they are actually parallel.',
    where: 'Line, at the top of the board',
  },
  {
    id: 'lines-carry-forward',
    date: '2026-08-28',
    kind: 'fixed',
    title: 'Lines stay put when you tap out a pass',
    body: 'Tapping two players to draw a pass makes the next phase for you, and it used to arrive with every line you had drawn wiped off it. Arrows should go, because an arrow describes the move you have just made. A line is not a move, it is part of the board, so lines now carry across to the phase the pass creates, exactly as they already did on Add phase.',
    where: 'Pass, at the top of the board',
  },
  {
    id: 'line-tool',
    date: '2026-08-28',
    kind: 'new',
    title: 'Draw a line, not an arrow',
    body: 'Line is a new tool at the top, next to Switch. It draws a plain line with no arrowhead on it, which is what you want for the line of confrontation, an offside line, or the height past which nobody follows. An arrow says somebody is going there; a line just divides the board. It bows on the same handle as an arrow, takes a label the same way, and holds on to a player if you drop an end on one.',
    where: 'Line, at the top of the board',
  },
  {
    id: 'zone-shapes',
    date: '2026-08-28',
    kind: 'new',
    title: 'Shaded areas can be a triangle or a diamond',
    body: 'Two more shapes beside Box, Rounded and Oval. A triangle for a space that funnels, like a trap closing on the touchline, because a box says the whole area is equally bad to be in and a funnel does not. A diamond for the pocket between four players. Shape is only how it looks, so you can change your mind as often as you like without redrawing it.',
    where: 'Click a shaded area, then Shape',
  },
  {
    id: 'phase-title-carries',
    date: '2026-08-28',
    kind: 'better',
    title: 'A new phase keeps the title you already typed',
    body: 'Adding a phase used to stamp "Phase 7" over the top of it. Now the title carries forward from the phase you added it after: three beats of one idea share the heading you wrote once, and if you had not written one the new phase stays blank instead of putting a number where your words go. Change it whenever you like and everything after it follows.',
    where: 'Add phase, then Title in the phase panel',
  },
  {
    id: 'no-count-in-film',
    date: '2026-08-28',
    kind: 'better',
    title: 'The phase count is off the film',
    body: 'Videos no longer carry "05 / 36" in the top corner. The bar along the bottom already says how far through it is, and a number counting down to thirty-six mostly tells whoever is watching how much is left to sit through. Exported pictures keep the count, because a still handed round on its own has no other way to say which phase it is.',
    where: 'Video',
  },
  {
    id: 'ask-the-studio',
    date: '2026-08-28',
    kind: 'new',
    title: 'Ask the studio where something is',
    body: 'The ? button is a search box now. Type what you are trying to do in your own words — pass, badge, cones, too fast, my name is not on it — and it finds the control, opens the drawer it lives in and puts a ring round it. Everything is still there to browse if you have no word for it, grouped by the part of the studio it belongs to.',
    where: 'The ? at the top right',
  },
  {
    id: 'unsigned-warning',
    date: '2026-08-28',
    kind: 'better',
    title: 'A film no longer goes out unsigned by accident',
    body: 'Put my name on it does nothing if there is no name on your account, and until now nothing said so — the film simply arrived anonymous. Video and Images now tell you before you export, with a link to set it once. Your name and club sign everything you make afterwards.',
    where: 'Video or Images and PDF, under Put my name on it',
  },
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
