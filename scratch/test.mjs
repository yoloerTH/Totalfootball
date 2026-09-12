import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase.rpc('test_foldername', {}) // Doesn't exist probably
  const res = await supabase.from('storage.objects').select('name').limit(1)
  console.log(res)
}
run()
