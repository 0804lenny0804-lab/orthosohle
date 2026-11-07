import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export function readConfig(env = process.env) {
  if (env.LOCAL_AUTH_ENABLED !== 'true') {
    throw new Error('Set LOCAL_AUTH_ENABLED=true for local synthetic-account development.');
  }
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 random characters.');
  }
  const url = new URL(env.AUTH_BASE_URL || 'http://127.0.0.1:3000');
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)
      || url.port === '0' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('AUTH_BASE_URL must be a plain HTTP loopback origin.');
  }
  const webURL = new URL(env.AUTH_WEB_ORIGIN || 'http://127.0.0.1:5173');
  if (webURL.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(webURL.hostname)
      || webURL.port === '0' || webURL.username || webURL.password || webURL.pathname !== '/'
      || webURL.search || webURL.hash) {
    throw new Error('AUTH_WEB_ORIGIN must be a plain HTTP loopback origin.');
  }
  const databasePath = env.AUTH_DATABASE_PATH
    || fileURLToPath(new URL('../data/local/auth.sqlite', import.meta.url));
  if (!isAbsolute(databasePath)) throw new Error('AUTH_DATABASE_PATH must be absolute.');
  return { secret, baseURL: url.origin, port: Number(url.port || 80), webOrigin: webURL.origin, databasePath };
}
