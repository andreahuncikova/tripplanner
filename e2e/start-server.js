// Starts the TripPlanner server for the end-to-end tests with its own empty database,
// so the tests never touch the real database on MongoDB Atlas.
// The database lives in memory and is gone when the tests stop.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { MongoMemoryServer } from 'mongodb-memory-server'

const mongo = await MongoMemoryServer.create()

const server = spawn('npx', ['tsx', 'src/server.ts'], {
  cwd: fileURLToPath(new URL('../server', import.meta.url)),
  stdio: 'inherit',
  env: {
    ...process.env,
    // Values set here win over server/.env, because dotenv never overwrites existing variables
    MONGO_URI: mongo.getUri('tripplanner-e2e'),
    PORT: '3100',
    JWT_SECRET: 'e2e-tests-only-secret-not-used-anywhere-else',
    CLIENT_URL: 'http://localhost:5180',
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
