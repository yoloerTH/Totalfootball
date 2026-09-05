import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const anon={apikey:env.SUPABASE_ANON_KEY,Authorization:`Bearer ${env.SUPABASE_ANON_KEY}`,'Content-Type':'application/json'}
const svc={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'}
const rpc=async(fn,b)=>(await (await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`,{method:'POST',headers:anon,body:JSON.stringify(b)})).json())
const q=async query=>JSON.parse(await (await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/execute_sql`,{method:'POST',headers:svc,body:JSON.stringify({query})})).text())
console.log(await q(`select left(title,30) title, reaction_count r, comment_count c, repost_count rp,
  round(extract(epoch from (now()-published_at))/3600) h,
  round(((reaction_score + 2*comment_count + 3*repost_count + 1) / power(extract(epoch from (now()-published_at))/3600.0 + 4, 1.2))::numeric,3) score
  from studio_posts order by score desc`).then(rows=>rows.map(x=>` ${String(x.title).padEnd(32)} r=${x.r} c=${x.c} rp=${x.rp} ${String(x.h).padStart(3)}h  score=${x.score}`).join('\n')))
console.log('\nfeatured:', (await rpc('studio_feed',{want_mode:'featured',want_limit:10,want_offset:0})).map(r=>r.title))
console.log('recent  :', (await rpc('studio_feed',{want_mode:'recent',want_limit:10,want_offset:0})).map(r=>r.title))
