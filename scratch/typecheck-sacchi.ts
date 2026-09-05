import type { System } from '../src/studio/schema'
import doc from '../content/systems/sacchis-25-metres.json'
const system: System = doc as System
export const ok: string = system.title
