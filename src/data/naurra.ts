/**
 * The operator's record: who is teaching this, and what they have actually
 * shipped.
 *
 * WHY THIS EXISTS. /course/ asks a stranger for 39 euro a month to learn two
 * skills, and the page had no answer at all to the only question that matters
 * before that: why would I learn this from you. "We run a football channel"
 * is a thin answer. The real one is that Total Football is published by an AI
 * company with ten delivered client systems behind it, and the channel is one
 * of them.
 *
 * SOURCE OF TRUTH, AND THE RULE FOR CHANGING IT.
 *
 * Every entry below is copied from the case studies on the company site,
 * `AI ASSITANT FULL/voice-ai-client/src/data/caseStudies.ts`, which is where
 * these are written, checked and published with the client's context. Nothing
 * here may be rounded up, re-phrased into something stronger, or invented. If
 * a figure changes there, change it here; if a study is not on naurra.ai, it
 * does not go on this page, because every card links out to the page that
 * substantiates it.
 *
 * These are CLIENT outcomes. They are evidence that the people teaching this
 * have done it, and they are not a forecast of what a student will earn. The
 * page says that in as many words, and docs/SPEC.md §11 requires it.
 */

export const OPERATOR = {
  name: 'Naurra AI',
  url: 'https://naurra.ai',
  caseStudiesUrl: 'https://naurra.ai/case-studies/',
  /** Delivered systems published as case studies on naurra.ai. */
  shipped: 10,
  /** One line on who is behind the course, used above the record. */
  blurb:
    'Total Football is published by Naurra AI, the company that builds these systems for other businesses. The channel is one of ten shipped systems, and it is the one we are handing over.',
} as const

export interface CaseStudy {
  /** Slug on naurra.ai/case-studies/. */
  slug: string
  industry: string
  title: string
  /** The headline outcome, exactly as the case study states it. */
  metric: string
  /** What that outcome was, in one line a stranger can follow. */
  note: string
  /** Which of the course's two skills this is evidence for. */
  skill: 'motion' | 'automation'
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: 'ai-motion-graphics-content-engine-social-growth',
    industry: 'Media and social growth',
    title: 'The content engine behind this channel',
    metric: '5M+ plays',
    note: 'Every frame rendered from code instead of edited by hand, with published retention data fed back into the format. Median reach per short rose 5.4x, from 978 plays to 5,330.',
    skill: 'motion',
  },
  {
    slug: 'ai-travel-concierge-whatsapp-telegram-itineraries',
    industry: 'Travel',
    title: 'AI travel concierge',
    metric: '€15k to €27k a month',
    note: 'A chat agent on WhatsApp and Telegram that turns a conversation into a finished itinerary. Build time per itinerary fell from about three hours to under half an hour, freeing over 180 staff hours a month.',
    skill: 'automation',
  },
  {
    slug: 'automotive-sourcing-engine-profit-automation',
    industry: 'Automotive',
    title: 'Automotive sourcing engine',
    metric: '$15k every two weeks',
    note: 'A system that scans marketplaces, filters undervalued stock and surfaces profitable cars before a competitor finds them. Four weeks from first conversation to live monitoring.',
    skill: 'automation',
  },
  {
    slug: 'mep-quotation-intelligence-hvac-case-study',
    industry: 'HVAC and MEP',
    title: 'Quotation intelligence',
    metric: '95% faster',
    note: 'Reads a project spec, matches equipment against supplier catalogues and produces a review-ready quote. What took most of a working day now takes minutes.',
    skill: 'automation',
  },
]

/** Deep link to a study on the company site. */
export const caseStudyUrl = (slug: string) => `${OPERATOR.caseStudiesUrl}${slug}/`
