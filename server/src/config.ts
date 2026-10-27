// Connection string to MongoDB Atlas
export const MONGO_URI = process.env.MONGO_URI ||
  'mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/tripplanner?retryWrites=true&w=majority';

export const PORT = Number(process.env.PORT) || 3000;

// Addresses of the React client that may call this server (CORS), comma-separated.
// On Render: the Vercel address. Locally the Vite proxy is used, so the default is enough.
export const CLIENT_URLS = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',').map(url => url.trim().replace(/\/$/, ''));

// Secret used to sign JWT tokens. There is no default value on purpose: the repository is public,
// so with a known secret anyone could create a valid token for any user.
// The server refuses to start without a long enough secret.
const secret = process.env.JWT_SECRET || '';
if (secret.length < 32) {
  throw new Error('JWT_SECRET is missing or shorter than 32 characters. Generate one with: ' +
    `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`);
}
export const JWT_SECRET  = secret;
export const JWT_EXPIRES = '7d';

// A palette of colors — one is picked randomly when a user registers and used as their avatar color throughout the app
export const COLORS = ['#E8572A','#4A90A4','#6BAB5E','#9B59B6','#E67E22','#E91E63','#00BCD4','#3498DB','#1ABC9C','#F39C12'];
