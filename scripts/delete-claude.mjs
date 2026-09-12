import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

function envVar(name) {
  if (process.env[name]) return process.env[name]
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8')
    const m = raw.match(new RegExp(`^${name}=(.*)$`, 'm'))
    if (!m) return ''
    return m[1].trim().replace(/^"(.*)"$/, '$1')
  } catch {
    return ''
  }
}

const supabaseUrl = envVar('SUPABASE_URL')
const supabaseKey = envVar('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

const emailsToDelete = [
  'claude-demo-a-1788517918676@example.com',
  'claude-demo-b-1788517919150@example.com',
  'claude-demo-c0-1788517959185@example.com',
  'claude-demo-c1-1788517960320@example.com',
  'claude-demo-c2-1788517961070@example.com',
  'claude-demo-c3-1788517961624@example.com'
]

async function run() {
  console.log("Deleting from subscribers...");
  const { data: subData, error: subError } = await supabase
    .from('subscribers')
    .delete()
    .in('email', emailsToDelete)
  if (subError) console.error("Error deleting from subscribers", subError)
  else console.log("Subscribers deleted", subData)

  console.log("Finding users in auth.users...");
  // List all users and filter by email
  // Actually, we can fetch users page by page or just let supabase-js do it if we have few users
  // Wait, supabase.auth.admin.listUsers() 
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()
  if (authError) {
    console.error("Error fetching auth users", authError)
  } else {
    const usersToDelete = users.filter(u => emailsToDelete.includes(u.email))
    console.log(`Found ${usersToDelete.length} users to delete from auth.users`)
    for (const u of usersToDelete) {
       console.log("Deleting user", u.email, u.id)
       await supabase.auth.admin.deleteUser(u.id)
    }
  }

  console.log("Done")
}
run()
