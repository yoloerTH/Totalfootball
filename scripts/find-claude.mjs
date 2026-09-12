import { audience } from './lib/audience.mjs'

async function run() {
  const data = await audience()
  const allEmails = data.all.map(r => r.email)
  const claudeEmails = allEmails.filter(e => e.includes('claude'))
  console.log("Claude emails found:", claudeEmails)
}
run()
