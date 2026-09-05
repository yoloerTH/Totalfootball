import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const q = async query => (await (await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/execute_sql`, {method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({query})})).text())
console.log('posts left        :', await q('select count(*) from studio_posts'))
console.log('profiles          :', await q("select visibility, count(*) from studio_profiles group by 1 order by 1"))
console.log('probe handle gone :', await q("select count(*) from studio_profiles where handle = 'claude_rls_probe'"))
