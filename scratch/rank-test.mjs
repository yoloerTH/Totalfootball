import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const URL_=env.SUPABASE_URL, SVC=env.SUPABASE_SERVICE_ROLE_KEY, ANON=env.SUPABASE_ANON_KEY
const svc={apikey:SVC,Authorization:`Bearer ${SVC}`,'Content-Type':'application/json'}
const anon={apikey:ANON,Authorization:`Bearer ${ANON}`,'Content-Type':'application/json'}
const rpc=async(fn,b)=>(await (await fetch(`${URL_}/rest/v1/rpc/${fn}`,{method:'POST',headers:anon,body:JSON.stringify(b)})).json())
const q=async query=>JSON.parse(await (await fetch(`${URL_}/rest/v1/rpc/execute_sql`,{method:'POST',headers:svc,body:JSON.stringify({query})})).text())

const oldest = (await rpc('studio_feed',{want_mode:'recent',want_limit:10,want_offset:0})).at(-1)
console.log(`piling engagement onto the OLDEST post: ${oldest.id} "${oldest.title}" (published ${oldest.published_at})\n`)

for (let i = 0; i < 4; i++) {
  const email=`claude-demo-c${i}-${Date.now()}@example.com`, password=`Tf-${Math.random().toString(36).slice(2)}-9xQ`
  const u = await (await fetch(`${URL_}/auth/v1/admin/users`,{method:'POST',headers:svc,body:JSON.stringify({email,password,email_confirm:true})})).json()
  const s = await (await fetch(`${URL_}/auth/v1/token?grant_type=password`,{method:'POST',headers:anon,body:JSON.stringify({email,password})})).json()
  const h = {apikey:ANON,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'}
  await fetch(`${URL_}/rest/v1/studio_profiles`,{method:'POST',headers:{...h,Prefer:'resolution=merge-duplicates'},body:JSON.stringify([{id:u.id,presenter:`Coach ${i+1}`,handle:`demo_c${i}_${Date.now().toString(36).slice(-4)}`,visibility:'public'}])})
  await fetch(`${URL_}/rest/v1/studio_reactions`,{method:'POST',headers:{...h,Prefer:'resolution=merge-duplicates'},body:JSON.stringify([{post:oldest.id,owner:u.id,kind:i===0?'training_ground':'golazo'}])})
  if (i < 2) await fetch(`${URL_}/rest/v1/studio_comments`,{method:'POST',headers:h,body:JSON.stringify([{post:oldest.id,owner:u.id,body:'We ran this. The far side holder has to start narrower than drawn.'}])})
  await fetch(`${URL_}/rest/v1/studio_reposts`,{method:'POST',headers:h,body:JSON.stringify([{post:oldest.id,owner:u.id,note:null}])})
}

console.log('scores now:')
console.log(await q(`select id, left(title,28) title,
  reaction_score, comment_count, repost_count,
  round(extract(epoch from (now()-published_at))/3600) hours_old,
  round(((reaction_score + 2*comment_count + 3*repost_count + 1) / power(extract(epoch from (now()-published_at))/3600.0 + 2, 1.5))::numeric, 4) score
  from studio_posts order by score desc`).then(r=>r.map(x=>` ${x.id} ${String(x.title).padEnd(30)} ${String(x.hours_old).padStart(3)}h  score=${x.score}`).join('\n')))
console.log('\nfeatured order :', (await rpc('studio_feed',{want_mode:'featured',want_limit:10,want_offset:0})).map(r=>r.title))
console.log('recent order   :', (await rpc('studio_feed',{want_mode:'recent',want_limit:10,want_offset:0})).map(r=>r.title))
