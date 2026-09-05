import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const URL_ = env.SUPABASE_URL, SVC = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.SUPABASE_ANON_KEY
const svc = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' }
const anon = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }
const line = (label, ok, extra='') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)

const email = `claude-rls-${Date.now()}@example.com`, password = `Tf-${Math.random().toString(36).slice(2)}-9xQ`
const made = await fetch(`${URL_}/auth/v1/admin/users`, { method:'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) })
const user = await made.json()
if (!user.id) { console.error('could not create test user', user); process.exit(1) }

const signed = await (await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method:'POST', headers: anon, body: JSON.stringify({ email, password }) })).json()
const asUser = { apikey: ANON, Authorization: `Bearer ${signed.access_token}`, 'Content-Type': 'application/json' }

const doc = { v:1, title:'RLS probe', acts:[{ tokens: [] }] }
const post = async (h, body) => fetch(`${URL_}/rest/v1/studio_posts`, { method:'POST', headers:{...h, Prefer:'return=representation'}, body: JSON.stringify([body]) })

// 1. the coach inserts their own post
const mine = await post(asUser, { id:'aaaaaa1', owner:user.id, doc, title:'Mine', visibility:'unlisted' })
line('signed-in coach can insert their own post', mine.status === 201, `HTTP ${mine.status}`)

// 2. the coach cannot insert a post owned by somebody else
const theirs = await post(asUser, { id:'aaaaaa2', owner:'00000000-0000-0000-0000-000000000000', doc, title:'Not mine' })
line('cannot insert a post under another owner', theirs.status >= 400, `HTTP ${theirs.status}`)

// 3. anon cannot see an unlisted post through the table
const tableRead = await (await fetch(`${URL_}/rest/v1/studio_posts?id=eq.aaaaaa1&select=id,title`, { headers: anon })).json()
line('anon cannot read an unlisted post from the table', Array.isArray(tableRead) && tableRead.length === 0, JSON.stringify(tableRead).slice(0,80))

// 4. anon CAN open it through the keyhole, with the exact id
const rpc = await (await fetch(`${URL_}/rest/v1/rpc/studio_post_by_id`, { method:'POST', headers: anon, body: JSON.stringify({ want:'aaaaaa1' }) })).json()
line('anon can open an unlisted post by exact id', Array.isArray(rpc) && rpc.length === 1, `${Array.isArray(rpc) ? rpc.length : '?'} row`)

// 5. the owner flips it public; now the feed shows it
await fetch(`${URL_}/rest/v1/studio_posts?id=eq.aaaaaa1`, { method:'PATCH', headers: asUser, body: JSON.stringify({ visibility:'public' }) })
const feed = await (await fetch(`${URL_}/rest/v1/studio_posts?select=id,visibility&order=published_at.desc`, { headers: anon })).json()
line('a public post appears to anon', Array.isArray(feed) && feed.some(r => r.id === 'aaaaaa1'), `${feed.length} public row(s)`)
line('the feed contains no unlisted rows', Array.isArray(feed) && feed.every(r => r.visibility === 'public'))

// 6. anon cannot edit or delete it
const edit = await fetch(`${URL_}/rest/v1/studio_posts?id=eq.aaaaaa1`, { method:'PATCH', headers: anon, body: JSON.stringify({ title:'hijacked' }) })
line('anon cannot edit a public post', edit.status >= 400, `HTTP ${edit.status}`)

// 7. a profile check: the test coach sets themselves unlisted and is reachable only by handle
await fetch(`${URL_}/rest/v1/studio_profiles`, { method:'POST', headers: {...asUser, Prefer:'resolution=merge-duplicates'}, body: JSON.stringify([{ id:user.id, handle:'claude_rls_probe', presenter:'Probe', visibility:'unlisted' }]) })
const profTable = await (await fetch(`${URL_}/rest/v1/studio_profiles?handle=eq.claude_rls_probe&select=handle`, { headers: anon })).json()
line('anon cannot read an unlisted profile from the table', Array.isArray(profTable) && profTable.length === 0, JSON.stringify(profTable).slice(0,60))
const profRpc = await (await fetch(`${URL_}/rest/v1/rpc/studio_profile_by_handle`, { method:'POST', headers: anon, body: JSON.stringify({ want:'claude_rls_probe' }) })).json()
line('anon can open an unlisted profile by exact handle', Array.isArray(profRpc) && profRpc.length === 1)
line('the keyhole returns no folders column', Array.isArray(profRpc) && profRpc[0] && !('folders' in profRpc[0]), Object.keys(profRpc[0] || {}).join(','))

// clean up: deleting the user cascades the post and the profile row
await fetch(`${URL_}/auth/v1/admin/users/${user.id}`, { method:'DELETE', headers: svc })
const left = await (await fetch(`${URL_}/rest/v1/rpc/execute_sql`, { method:'POST', headers: svc, body: JSON.stringify({ query: `select count(*) from studio_posts where id = 'aaaaaa1'` }) })).json()
line('deleting the account removed the post', JSON.stringify(left).includes('"count": 0'), JSON.stringify(left))
