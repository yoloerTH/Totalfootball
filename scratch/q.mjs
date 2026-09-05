import { sql } from '../scripts/apply-migration.mjs'
const q = process.argv[2]
console.log(JSON.stringify(await sql(q), null, 2))
