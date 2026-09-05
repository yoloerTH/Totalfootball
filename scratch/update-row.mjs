import { readFileSync } from 'node:fs'
function envVar(n){const raw=readFileSync('.env','utf8');const m=raw.match(new RegExp(`^${n}=(.*)$`,'m'));return m?m[1].trim().replace(/^"(.*)"$/,'$1'):''}
const url=envVar('SUPABASE_URL'), key=envVar('SUPABASE_SERVICE_ROLE_KEY')
const h={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'}
const OWNER='04189c96-21fb-4772-9177-408856ec2c46', ID='bp3va5uwmfb1h'
const doc=JSON.parse(readFileSync('content/systems/sacchis-25-metres.json','utf8'))
const res=await fetch(`${url}/rest/v1/studio_systems?owner=eq.${OWNER}&id=eq.${ID}`,{method:'PATCH',headers:h,body:JSON.stringify({doc})})
if(!res.ok){console.error(res.status, await res.text());process.exit(1)}
const [row]=await res.json()
const sort=(v)=>Array.isArray(v)?v.map(sort):(v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v)
console.log('updated in place:', row.id, '|', row.title, '| phases', row.doc.acts.length, '| pitch', row.doc.pitch)
console.log('deep-equal to local file:', JSON.stringify(sort(row.doc))===JSON.stringify(sort(doc)))
const all=await (await fetch(`${url}/rest/v1/studio_systems?owner=eq.${OWNER}&title=eq.${encodeURIComponent("Sacchi's 25 Metres")}&select=id`,{headers:h})).json()
console.log('copies of this system on the account:', all.length, all.map(r=>r.id).join(', '))
