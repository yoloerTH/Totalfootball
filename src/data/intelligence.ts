/**
 * Total Stats · Daily Intelligence: the public record.
 *
 * READ THIS BEFORE CHANGING A NUMBER.
 *
 * A permanent, indexable web page making profit claims is a different risk
 * surface from a chip inside a video. The rules, from the project's own
 * reporting discipline (docs/SPEC.md §10):
 *
 *  1. Always carry the unit size. A bare "+9.63" is unverifiable.
 *  2. Lead with the LAST-10 rate, not all-time. The all-time +34% is still
 *     carried by a hot start in late June, and the project's own report says so.
 *  3. Never quote CLV as evidence. Capture coverage is ~8%; the report states
 *     plainly that it "is not yet evidence and we will not quote it as though
 *     it were."
 *  4. Two staked club picks is a result, not a rate. Do not derive a percentage
 *     from it.
 *
 * Source: football-ev-lab/backend/reports/2026-08-07-after-match-telegram.txt
 * (grep 'OVERALL · SINCE' or 'THE TWO RECORDS' in the newest file to refresh).
 */

export const LEDGER = {
  asOf: '2026-08-07',
  /** Confirmed by the user 2026-08-09. The reports' footer still prints an
   *  older handle (t.me/TotalStatsAIAnalysis); this is the one to link. */
  telegram: 'https://t.me/totalfootballstats',
  handle: '@totalfootballstats',

  national: {
    label: 'National sides',
    cards: 17,
    picks: 98,
    profitUnits: 9.63,
    stakedUnits: 28.2,
    allTimeRoi: '+34%',
    last10Roi: '+7%',
    status: 'in production' as const,
  },

  club: {
    label: 'Clubs',
    cards: 4,
    stakedPicks: 2,
    won: 1,
    lost: 1,
    profitUnits: 0.52,
    status: 'early, paper track' as const,
    /** Rendered verbatim. The honesty is the selling point. */
    caveat: 'Two staked picks is a result, not a rate. We will not quote a percentage off it.',
  },
} as const

export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Price the match',
    body: 'A rated model turns team strength, venue and competition into a probability for every outcome, before any bookmaker price is looked at.',
  },
  {
    step: '02',
    title: 'Compare to the market',
    body: 'That probability is set against the median fair price across the books, with the outlier and junk prices dropped rather than cherry-picked.',
  },
  {
    step: '03',
    title: 'Bet only the gap',
    body: 'If the model and the market disagree by enough to cover the margin, it is a card. Most days, on most matches, they do not, and nothing is posted.',
  },
  {
    step: '04',
    title: 'Grade everything',
    body: 'Every pick is written down before kickoff and graded after. Losing cards are published in the same detail as winning ones.',
  },
] as const
