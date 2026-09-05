import { sql } from '../scripts/apply-migration.mjs'
const U = '7b28c2ea-5c4c-4012-82f0-b4579edcbb5e'
const claims = JSON.stringify({ sub: U, role: 'authenticated' })
const doc = JSON.stringify({ name: '  Third-man run  ', sourcePitch: 'attacking-half', acts: [{ id: 'a1' }, { id: 'a2' }], playerCount: 5 })
const run = async (label, body) => {
  const q = `do $$ begin perform set_config('request.jwt.claims', $claims$${claims}$claims$, true); perform set_config('role','authenticated',true); end $$;`
  console.log(label, JSON.stringify(await sql(`${q} ${body}`), null, 1))
}
// execute_sql runs each call separately, so set the claims and act in ONE statement via a DO block returning through a temp table is awkward.
// Instead: wrap in a single SELECT with a CTE after set_config in the same statement.
const one = async (label, expr) => {
  const q = `select set_config('request.jwt.claims', $c$${claims}$c$, true), (${expr}) as result`
  console.log(label, JSON.stringify(await sql(q), null, 1))
}
await one('save   ', `public.studio_sequences_save('seqtest1', $d$${doc}$d$::jsonb)`)
await one('row    ', `(select to_jsonb(s) - 'doc' from public.studio_sequences s where id='seqtest1')`)
await one('rename ', `public.studio_sequences_rename('seqtest1', ' My rondo reset ')`)
await one('row2   ', `(select to_jsonb(s) - 'doc' from public.studio_sequences s where id='seqtest1')`)
await one('delete ', `public.studio_sequences_delete('seqtest1')`)
await one('gone   ', `(select count(*) from public.studio_sequences where id='seqtest1')`)
