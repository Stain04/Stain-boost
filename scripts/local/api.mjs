// Runs the files in /api like Vercel Functions: /api/foo -> api/foo.js, /api/foo/bar -> api/foo/[x].js
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function resolveApi(root, pathname) {
  const rel = pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
  if (!rel || rel.split('/').some((p) => p.startsWith('_') || p === '..')) return null;
  const direct = path.join(root, 'api', rel + '.js');
  if (fs.existsSync(direct)) return { file: direct, params: {} };
  const parts = rel.split('/');
  if (parts.length === 2) {
    const dir = path.join(root, 'api', parts[0]);
    if (fs.existsSync(dir)) {
      const dyn = fs.readdirSync(dir).find((f) => /^\[.+\]\.js$/.test(f));
      if (dyn) return { file: path.join(dir, dyn), params: { [dyn.slice(1, -4)]: parts[1] } };
    }
  }
  return null;
}

export async function handleApi(root, req, res, url) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); return res; };
  res.send = (b) => { res.end(typeof b === 'string' ? b : JSON.stringify(b)); return res; };
  const r = resolveApi(root, url.pathname);
  if (!r) return res.status(404).json({ error: 'Not found' });
  let raw = '';
  for await (const c of req) raw += c;
  req.body = raw && /json/.test(req.headers['content-type'] || '') ? JSON.parse(raw) : {};
  req.query = { ...Object.fromEntries(url.searchParams), ...r.params };
  const mod = await import(pathToFileURL(r.file).href);
  return mod.default(req, res);
}
