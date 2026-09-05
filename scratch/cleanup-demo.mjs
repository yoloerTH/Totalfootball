import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const URL_ = env.SUPABASE_URL, SVC = env.SUPABASE_SERVICE_ROLE_KEY
const svc = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' }
const q = async query => (await (await fetch(`${URL_}/rest/v1/rpc/execute_sql`, {method:'POST',headers:svc,body:JSON.stringify({query})})).text())
const ids = JSON.parse(await q("select id::text from auth.users where email like 'claude-demo-%' or email like 'claude-rls-%'")).map(r => r.id)
for (const id of ids) {
  const r = await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: svc })
  console.log('deleted', id, r.status)
}
console.log('posts left  :', await q('select count(*) from studio_posts'))
console.log('profiles    :', await q('select count(*) from studio_profiles'))
console.log('comments    :', await q('select count(*) from studio_comments'))
