// Local only: when no Upstash/KV credentials are set, swap @vercel/kv for an
// in-memory store so the real API code runs without touching production data.
import { registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const hasKv = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL;
if (!hasKv) {
  const mock = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'mock-kv.mjs')).href;
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier === '@vercel/kv') return { url: mock, shortCircuit: true };
      return next(specifier, context);
    },
  });
  process.env.UPSTASH_REDIS_REST_URL = 'http://in-memory';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'local';
  process.env.JWT_SECRET ||= 'local-dev-secret';
  process.env.ADMIN_KEY ||= 'local-admin-key';
  console.log('[local] No KV credentials: using an in-memory database (admin key: local-admin-key).');
}
