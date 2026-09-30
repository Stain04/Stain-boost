// In-memory stand-in for @vercel/kv (Upstash). Mimics Upstash auto-(de)serialization:
// objects are JSON-stringified on write; on read, strings are JSON.parse'd when possible.
const store = new Map();
const expiries = new Map();
function alive(k) { const e = expiries.get(k); if (e && e < Date.now()) { store.delete(k); expiries.delete(k); } return store.has(k); }
function ser(v) { return typeof v === 'string' ? v : JSON.stringify(v); }
function de(v) { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } }
export const __store = store;
export function createClient() {
  return {
    async get(k) { return alive(k) ? de(store.get(k)) : null; },
    async set(k, v, opts) { store.set(k, ser(v)); if (opts?.ex) expiries.set(k, Date.now() + opts.ex * 1000); else expiries.delete(k); return 'OK'; },
    async del(k) { const had = store.delete(k); expiries.delete(k); return had ? 1 : 0; },
    async expire(k, s) { if (!alive(k)) return 0; expiries.set(k, Date.now() + s * 1000); return 1; },
    async sadd(k, ...m) { const s = alive(k) ? store.get(k) : new Set(); m.forEach(x => s.add(ser(x))); store.set(k, s); return m.length; },
    async sismember(k, m) { return alive(k) && store.get(k).has(ser(m)) ? 1 : 0; },
    async smembers(k) { return alive(k) ? [...store.get(k)].map(de) : []; },
    async lpush(k, ...v) { const l = alive(k) ? store.get(k) : []; v.forEach(x => l.unshift(ser(x))); store.set(k, l); return l.length; },
    async rpush(k, ...v) { const l = alive(k) ? store.get(k) : []; v.forEach(x => l.push(ser(x))); store.set(k, l); return l.length; },
    async lrange(k, a, b) { if (!alive(k)) return []; const l = store.get(k); const end = b < 0 ? l.length + b : b; return l.slice(a < 0 ? l.length + a : a, end + 1).map(de); },
    async ltrim(k, a, b) { if (!alive(k)) return 'OK'; const l = store.get(k); const s = a < 0 ? Math.max(0, l.length + a) : a; const e = b < 0 ? l.length + b : b; store.set(k, l.slice(s, e + 1)); return 'OK'; },
  };
}
