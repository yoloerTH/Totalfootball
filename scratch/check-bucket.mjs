import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase.storage
    .from('players')
    .list('7422b749-1bfe-4f9d-aa42-b72ecfe7c219/players', {
      limit: 100,
      offset: 0
    })
  console.log(JSON.stringify(error || data, null, 2))
}
run()
