import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres('postgresql://postgres:postgres@localhost:54322/postgres')

async function run() {
  const result = await sql`
    SELECT storage.foldername('7422b749-1bfe-4f9d-aa42-b72ecfe7c219/players/89c46e38.png') as foldername,
           (storage.foldername('7422b749-1bfe-4f9d-aa42-b72ecfe7c219/players/89c46e38.png'))[1] as part1
  `
  console.log(result)
  process.exit(0)
}
run()
