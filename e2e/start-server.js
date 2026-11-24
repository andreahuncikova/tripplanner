// Starts the TripPlanner server for the end-to-end tests with its own empty database,
// so the tests never touch the real database on MongoDB Atlas.
// The database lives in memory and is gone when the tests stop.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { MongoMemoryServer } from 'mongodb-memory-server'

const mongo = await MongoMemoryServer.create()

// Node itself with tsx loaded, not "npx tsx": on Windows npx is npx.cmd and cannot be started without a shell
const server = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
  cwd: fileURLToPath(new URL('../server', import.meta.url)),
  stdio: 'inherit',
  env: {
    ...process.env,
    // Values set here win over server/.env, because dotenv never overwrites existing variables
    MONGO_URI: mongo.getUri('tripplanner-e2e'),
    PORT: '3100',
    JWT_SECRET: 'e2e-tests-only-secret-not-used-anywhere-else',
    CLIENT_URL: 'http://localhost:5180',
    // Never ask Google or Unsplash and never send real e-mails from the tests, even when server/.env has keys
    // (Unsplash allows only 50 searches an hour, and the tests must not depend on the internet)
    GOOGLE_PLACES_KEY: '',
    UNSPLASH_ACCESS_KEY: '',
    RESEND_API_KEY: '',
    // The answer to an e-mail change then also holds the confirmation link, since the tests cannot read e-mails
    EMAIL_DEV_LINKS: '1',
    // The tests try wrong passwords on purpose, all from one address; on Render the limit stays 10
    AUTH_RATE_LIMIT: '1000',
  },
})

async function stop() {
  server.kill()
  await mongo.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
server.on('exit', async code => {
  await mongo.stop()
  process.exit(code ?? 0)
})
