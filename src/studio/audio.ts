/**
 * The soundtrack, which is one sound.
 *
 * A ball being struck, every time the ball moves. Nothing else — no music, no
 * whooshes, no riser. The videos this studio descends from have a whole SFX
 * palette (`editor/public/sfx/`), and deliberately not importing it is the
 * point: those are cues an editor places by hand against a script, and there is
 * no script here. There is a document.
 *
 * ── THE RULE, AND WHY IT IS A RULE AND NOT A FIELD ───────────────────────────
 *
 * A kick is THE BALL BEING IN A DIFFERENT PLACE IN THE NEXT PHASE. It is
 * derived from the document, exactly like the motion is, and for the same
 * reason: an Act is a pose, and everything between two poses is ours to work
 * out (see the note at the top of ./schema.ts). Nobody marks a kick. Nobody can
 * forget to mark a kick, or mark one that does not happen, or mark eleven and
 * leave the twelfth silent. Every system ever built in the studio — including
 * the ones saved before this file existed — is scored correctly the moment it
 * is rendered, because the information was always in there.
 *
 * The alternative was a `kick?: boolean` on Act. It would have been half a
 * day's less work and it would have been wrong: a document that can disagree
 * with itself about whether the ball was kicked is a document with a bug in it.
 *
 * A PASS ARROW IS NOT A KICK. Arrows are what the coach is *pointing at* — an
 * option, a run that was not made, the pass they should have played. If the
 * ball did not move, nothing was struck, and the frame stays quiet. The two
 * really are different things and the board already keeps them apart.
 *
 * ── WHAT IT SOUNDS LIKE ──────────────────────────────────────────────────────
 *
 * `official-ball-kick.mp3`, the same 130ms sample the shorts use, at the top of
 * the move — the ball leaves the foot when it starts travelling, not when it
 * arrives. Struck a little harder the further it goes, which is the one piece
 * of interpretation here and is also just true: a switch across the pitch is
 * not hit like a five-yard square ball. The shorts vary this by hand between
 * 0.32 and 0.58; this reads the distance off the document instead.
 */

import { ballsOf, type System } from './schema'
import { DEFAULT_HOLD_MS, DEFAULT_MOVE_MS, holdMs, moveMs } from './pace'

/** Lives in public/, like the match balls. Same reasoning as ./balls.ts. */
const KICK_SRC = '/studio/sfx/ball-kick.mp3'

/**
 * Below this the ball did not travel, it was tidied.
 *
 * In percent of the visible crop, so on a full pitch 0.75 is about 80cm. A
 * coach nudging the ball a pixel to line it up with a counter is not a pass and
 * must not click.
 */
const MOVED_PCT = 0.75

/** The quietest and loudest a kick gets, and the distance that reaches the top. */
const GAIN_MIN = 0.34
const GAIN_MAX = 0.6
const GAIN_FULL_PCT = 55

export interface Kick {
  /** When the ball leaves the foot, in ms from the top of the film. */
  ms: number
  /** 0–1, into a GainNode. */
  gain: number
}

/**
 * Every kick in a system, in order.
 *
 * The timing has to agree with `timelineAt()` or the sound drifts off the
 * picture, so it is derived from the same two numbers rather than from a value
 * typed in here: each phase holds for `hold` and then takes `move` to become
 * the next one, so the move out of phase `i` starts at
 * `i * (hold + move) + hold`.
 *
 * BOTH ARGUMENTS HAVE TO BE PASSED BY ANYONE RENDERING A REAL SYSTEM. The
 * defaults exist for a bare call, not as a shortcut: because the offset is
 * multiplied by `i`, a wrong `move` does not put the track a fixed distance
 * out, it puts kick `i` out by `i` times the error. A four-phase system with
 * the move stretched to 2.6s and this left on its default lands its last kick
 * a full three seconds early, which is not a sync problem any more, it is the
 * wrong sound over the wrong picture.
 */
export function kicks(system: System, hold = DEFAULT_HOLD_MS, move = DEFAULT_MOVE_MS): Kick[] {
  const beat = hold + move
  const out: Kick[] = []

  for (let i = 0; i < system.acts.length - 1; i++) {
    /*
     * The FURTHEST-TRAVELLED ball sets the kick, matched by id.
     *
     * One sound per transition, because that is what the beat is: a phase
     * becomes the next phase and you hear the pass that did it. On a drill with
     * six balls moving at once, the longest journey is the one the ear would
     * have picked out anyway, and six kicks stacked on one frame is a thud.
     *
     * A ball that appears or is taken off the board did not travel. Only a ball
     * on the board in both poses can have been kicked between them.
     */
    const fromBalls = ballsOf(system.acts[i])
    const toBalls = ballsOf(system.acts[i + 1])
    let dist = 0
    for (const from of fromBalls) {
      const to = toBalls.find((b) => b.id === from.id)
      if (!to) continue
      dist = Math.max(dist, Math.hypot(to.x - from.x, to.y - from.y))
    }
    if (dist < MOVED_PCT) continue

    const t = Math.min(1, dist / GAIN_FULL_PCT)
    out.push({ ms: i * beat + hold, gain: GAIN_MIN + (GAIN_MAX - GAIN_MIN) * t })
  }

  return out
}

/**
 * How far into the sample the ball is actually struck, in seconds.
 *
 * WHAT YOU HEAR IS THE TRANSIENT, so the transient is what has to land on the
 * beat — not the first sample of the file. `ball-kick.mp3` opens with 34ms of
 * near-silence, which is an artefact of the MP3 encoder's own delay rather than
 * anything anybody recorded, and scheduling the file at the top of the move put
 * the strike 34ms after the ball started travelling. That is a sixth of a beat
 * and it reads as a sound effect stuck on afterwards.
 *
 * Measured rather than typed in as a constant: 34ms is a fact about one
 * encoding of one file, and the first person to re-export the sample would
 * silently get the lag back. Relative to the peak, not an absolute level, so it
 * does not care how loud the sample happens to be.
 */
function onset(sample: AudioBuffer): number {
  const pcm = sample.getChannelData(0)
  let peak = 0
  for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]))
  if (peak === 0) return 0

  const floor = peak * 0.05
  for (let i = 0; i < pcm.length; i++) {
    if (Math.abs(pcm[i]) >= floor) return i / sample.sampleRate
  }
  return 0
}

/**
 * Mix the kicks into one track as long as the film.
 *
 * `OfflineAudioContext` because it is the only mixer in the browser that runs
 * faster than real time — an `AudioContext` would take twenty-five seconds to
 * produce twenty-five seconds. It also does the resampling: the sample is
 * 44.1kHz and the encoder wants 48kHz, and doing that by hand is how you get a
 * kick that sounds slightly wrong and nobody can say why.
 *
 * Returns null when there is nothing to play or the sample cannot be fetched.
 * A silent film is a fine outcome; a failed export because the sound effect
 * 404'd is not, and the caller treats it that way.
 *
 * THERE IS ABOUT 40ms LEFT, AND IT IS FINE. Measured on the finished mp4, the
 * strike lands at 2.640s against a move that starts at 2.600s: AAC's own
 * priming delay, which the muxer does not compensate for. It is a frame and a
 * bit, against a tolerance for late audio of something like 125ms, and the only
 * way to take it out is a fudge factor keyed to the codec — which would be a
 * wrong number the moment a browser lands on Opus instead. Left alone on
 * purpose. Do not go looking for it again.
 */
export async function kickTrack(
  system: System,
  totalMs: number,
  sampleRate = 48_000,
): Promise<AudioBuffer | null> {
  // The system's own pace, not the default: a ball struck on the beat of a
  // 2.6s hold lands in silence once the coach has taken the film down to 1.4s,
  // and one struck on a 1.1s move lands before the pass once they have stretched
  // it. Both halves of the beat, every time.
  const marks = kicks(system, holdMs(system), moveMs(system))
  if (!marks.length) return null

  let sample: AudioBuffer
  try {
    const res = await fetch(KICK_SRC)
    if (!res.ok) throw new Error(String(res.status))
    // Decoding needs a context of its own: `OfflineAudioContext.decodeAudioData`
    // resamples to THAT context's rate, so it has to be the one we mix in.
    const ctx = new OfflineAudioContext(2, Math.ceil((totalMs / 1000) * sampleRate), sampleRate)
    sample = await ctx.decodeAudioData(await res.arrayBuffer())
    const lead = onset(sample)

    for (const k of marks) {
      const src = ctx.createBufferSource()
      src.buffer = sample
      const gain = ctx.createGain()
      gain.gain.value = k.gain
      src.connect(gain).connect(ctx.destination)
      // Started early by its own lead-in, so the STRIKE is on the beat. Clamped
      // at zero for a kick close enough to the top of the film that it cannot
      // be pulled back — it loses a few ms of silence and nothing else.
      src.start(Math.max(0, k.ms / 1000 - lead))
    }

    return await ctx.startRendering()
  } catch {
    return null
  }
}
