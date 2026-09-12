import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase
    .from('studio_squad')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)
  console.log(JSON.stringify(error || data, null, 2))
}
run()
