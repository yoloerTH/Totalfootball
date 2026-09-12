import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// Need to upload as the user, not as service role, to test RLS!
// We can mint a JWT for the user or just use a dummy user, but let's see what service role can do first.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const fileContent = Buffer.from('test image content')
  
  // Try to upload
  const { data, error } = await supabase.storage
    .from('players')
    .upload('7422b749-1bfe-4f9d-aa42-b72ecfe7c219/players/test.png', fileContent, {
      contentType: 'image/png',
      upsert: true
    })
    
  console.log('Upload Result:', JSON.stringify(error || data, null, 2))
}
run()
