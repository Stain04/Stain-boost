// ── /api/status — is Stain online right now, and is the free trial running? ──
// GET: public. POST: admin only (session admin or x-admin-key). Set from /admin.
// Online: for a number of hours (it switches itself off so the site never shows a stale claim),
// or with no timer ("forever") until Stain switches it off himself.
// Free trial: POST { trial: { endsAt } } runs it until that moment; { trial: { endsAt: 0 } } ends it now.
import { getKv, getUser, isAdmin, rateLimit, getIp } from './_lib/auth.js';
import { getTrial, TRIAL_KEY, MAX_TRIAL_DAYS } from './_lib/promo.js';

const KEY = 'stain_status';
const MAX_HOURS = 12;

export default async function handler(req, res) {
  const kv = getKv();

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=40');
    const trial = await getTrial(kv);
    const trialOut = { active: trial.active, endsAt: trial.active ? trial.endsAt : null, games: trial.games };
    // `known: false` until Stain has used the switch once — the site then shows no status at all.
    if (!kv) return res.status(200).json({ online: false, known: false, trial: trialOut });
    try {
      const raw = await kv.get(KEY);
      const s = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
      const online = !!(s && s.online && (s.forever || s.until > Date.now()));
      return res.status(200).json({ online, known: !!s, until: online && !s.forever ? s.until : null, forever: online && !!s.forever, trial: trialOut });
    } catch (e) {
      console.error('status get error', e);
      return res.status(200).json({ online: false, known: false, trial: trialOut });
    }
  }

  if (req.method === 'POST') {
    if (rateLimit('statusP:' + getIp(req), 20, 60_000)) return res.status(429).json({ error: 'Too many requests.' });
    const user = await getUser(req);
    const keyOk = process.env.ADMIN_KEY && (req.headers['x-admin-key'] === process.env.ADMIN_KEY);
    if (!isAdmin(user) && !keyOk) return res.status(401).json({ error: 'Unauthorized.' });
    if (!kv) return res.status(500).json({ error: 'Storage not configured.' });
    const body = req.body || {};

    // free trial timer
    if (body.trial && typeof body.trial === 'object') {
      const now = Date.now();
      const endsAt = Number(body.trial.endsAt) || 0;
      if (endsAt && (endsAt <= now || endsAt > now + MAX_TRIAL_DAYS * 864e5)) {
        return res.status(400).json({ error: `Pick an end time in the future, at most ${MAX_TRIAL_DAYS} days from now.` });
      }
      const current = await getTrial(kv, now);
      // keep the original start while it's already running; a new run starts now
      const startsAt = endsAt && current.active ? current.startsAt : now;
      await kv.set(TRIAL_KEY, JSON.stringify({ startsAt, endsAt: endsAt || now, updatedAt: now }));
      const trial = await getTrial(kv);
      return res.status(200).json({ ok: true, trial: { active: trial.active, endsAt: trial.active ? trial.endsAt : null, games: trial.games } });
    }

    // online switch
    const online = body.online === true;
    const forever = online && body.forever === true;
    const hours = Math.max(1, Math.min(MAX_HOURS, parseInt(body.hours, 10) || 4));
    const until = online && !forever ? Date.now() + hours * 3600_000 : 0;
    await kv.set(KEY, JSON.stringify({ online, forever, until, updatedAt: Date.now() }));
    return res.status(200).json({ ok: true, online, forever, until: online && !forever ? until : null });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
