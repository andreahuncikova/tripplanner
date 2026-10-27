import mongoose from 'mongoose';
import { MONGO_URI } from './config';

// Atlas can be asleep or unreachable when the server starts (this happened on 24 Oct 2026).
// Mongoose only reconnects by itself after the first connection has worked,
// so the first connection is retried here until the database answers.
const FIRST_DELAY = 5_000;   // wait 5 s after the first failed attempt
const MAX_DELAY   = 60_000;  // then double the wait each time, but never more than 1 minute

export async function connectWithRetry() {
  let delay = FIRST_DELAY;
  for (let attempt = 1; ; attempt++) {
    try {
      // Give up an attempt after 10 s, so we can log it and try again
      await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
      console.log('✅ MongoDB connected');
      logLaterDisconnects();
      return;
    } catch (e) {
      console.error(`❌ MongoDB (attempt ${attempt}):`, (e as Error).message, `— trying again in ${delay / 1000} s`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, MAX_DELAY);
    }
  }
}

// After the first connection Mongoose reconnects by itself; we only write it to the log,
// so it is visible in the Render logs when the database was gone for a while.
function logLaterDisconnects() {
  mongoose.connection.on('disconnected', () => console.error('❌ MongoDB disconnected — Mongoose is reconnecting'));
  mongoose.connection.on('reconnected',  () => console.log('✅ MongoDB reconnected'));
}

// 1 means "connected" in Mongoose
export const isDbReady = () => mongoose.connection.readyState === 1;
