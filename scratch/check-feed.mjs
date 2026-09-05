import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const anon = { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }
const rpc = async (fn, body) => (await (await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {method:'POST',headers:anon,body:JSON.stringify(body)})).json())
for (const mode of ['featured','recent']) {
  const rows = await rpc('studio_feed', { want_mode: mode, want_limit: 10, want_offset: 0 })
  console.log(`\n## ${mode}`)
  for (const r of rows) console.log(` ${r.id}  ${String(r.title).padEnd(32)} ${r.media.padEnd(5)} r=${r.reaction_count} c=${r.comment_count} rp=${r.repost_count} kinds=${JSON.stringify(r.kinds)} by=${r.presenter}`)
}
const mine = await rpc('studio_posts_by_handle', { want: 'demo_marta', want_limit: 10 })
console.log('\n## demo_marta profile posts:', mine.map(r => r.title))
const cs = await rpc('studio_post_comments', { want_post: (await rpc('studio_feed', { want_mode:'recent', want_limit:10, want_offset:0 })).find(r=>r.comment_count>0)?.id })
console.log('## comments:', cs.map(c => `${c.presenter}: ${c.body.slice(0,50)}…`))
