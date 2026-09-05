import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const URL_ = env.SUPABASE_URL, SVC = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.SUPABASE_ANON_KEY
const svc  = { apikey: SVC,  Authorization: `Bearer ${SVC}`,  'Content-Type': 'application/json' }
const anon = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }

// Two throwaway coaches, so a post has somebody other than its author to react to it.
const people = []
for (const [n, name, handle, licence, role] of [
  ['a', 'Marta Oyelaran', 'demo_marta', 'uefa_a', 'coach'],
  ['b', 'Piet van Dijk',  'demo_piet',  'uefa_b', 'analyst'],
]) {
  const email = `claude-demo-${n}-${Date.now()}@example.com`, password = `Tf-${Math.random().toString(36).slice(2)}-9xQ`
  const u = await (await fetch(`${URL_}/auth/v1/admin/users`, { method:'POST', headers: svc, body: JSON.stringify({ email, password, email_confirm: true }) })).json()
  const s = await (await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method:'POST', headers: anon, body: JSON.stringify({ email, password }) })).json()
  const h = { apikey: ANON, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' }
  await fetch(`${URL_}/rest/v1/studio_profiles`, { method:'POST', headers:{...h, Prefer:'resolution=merge-duplicates'}, body: JSON.stringify([{ id: u.id, presenter: name, handle, licence, role, team: n === 'a' ? 'Vale Rangers' : 'FC Noord', visibility: 'public', team_colour: n === 'a' ? '#1E6FD9' : '#C8102E' }]) })
  people.push({ id: u.id, h, name, handle })
  console.log('coach:', name, handle, u.id)
}

const docs = ['the-2-3-5-build-up','the-false-nine','overload-to-isolate','the-box-midfield-rest-defence']
  .map(slug => JSON.parse(fs.readFileSync(`content/systems/${slug}.json`, 'utf8')))

const titles = [
  ['The 2-3-5 build-up', 'Two against two at the back, three against four in midfield. What pushing both full backs inside does to a front two.', 'video', 0],
  ['The false nine, honestly', 'Who picks him up is the whole question. Six phases on what happens when nobody does.', 'video', 2],
  ['Overload to isolate', 'Everything on one side so the winger is alone on the other. The still is the moment before the switch.', 'image', 3],
  ['Rest defence in a box midfield', 'What the two holders are actually doing while the ball is in the final third.', 'video', 1],
]

const ids = []
for (let i = 0; i < titles.length; i++) {
  const [title, summary, media, cover] = titles[i]
  const person = people[i % 2]
  const doc = docs[i] && docs[i].acts ? docs[i] : (docs[i]?.system ?? docs[0])
  const A = '0123456789abcdefghjkmnpqrstvwxyz'
  const id = Array.from(crypto.getRandomValues(new Uint8Array(7)), b => A[b % A.length]).join('')
  const res = await fetch(`${URL_}/rest/v1/studio_posts`, { method:'POST', headers:{...person.h, Prefer:'return=minimal'}, body: JSON.stringify([{
    id, owner: person.id, doc, title, summary, media, cover_act: cover, visibility: 'public',
    published_at: new Date(Date.now() - i * 7 * 3600_000).toISOString(),
  }]) })
  console.log(res.status === 201 ? `post ok  ${id}  ${title}` : `post FAIL ${res.status} ${await res.text()}`)
  if (res.status === 201) ids.push({ id, by: person })
}

// Reactions and comments from the OTHER coach, so nothing is self-engagement.
const kinds = ['golazo','masterclass','training_ground','killer_ball','clean_sheet']
for (let i = 0; i < ids.length; i++) {
  const other = people.find(p => p.id !== ids[i].by.id)
  await fetch(`${URL_}/rest/v1/studio_reactions`, { method:'POST', headers:{...other.h, Prefer:'resolution=merge-duplicates'}, body: JSON.stringify([{ post: ids[i].id, owner: other.id, kind: kinds[i % kinds.length] }]) })
  if (i < 2) {
    await fetch(`${URL_}/rest/v1/studio_comments`, { method:'POST', headers: other.h, body: JSON.stringify([{ post: ids[i].id, owner: other.id, body: i === 0 ? 'The second phase is the one that sold it to me. We tried it against a back three and the far full back had to be five metres deeper.' : 'What does the ten do if the six follows him? Genuinely asking, we could not solve it last season.' }]) })
  }
  if (i === 1) await fetch(`${URL_}/rest/v1/studio_reposts`, { method:'POST', headers: other.h, body: JSON.stringify([{ post: ids[i].id, owner: other.id, note: 'Running a version of this on Thursday with the under 18s.' }]) })
}

console.log('\nseeded:', ids.map(x => x.id).join(', '))
fs.writeFileSync('scratch/seeded.json', JSON.stringify({ people: people.map(p => ({ id: p.id, handle: p.handle })), posts: ids.map(i => i.id) }, null, 2))
