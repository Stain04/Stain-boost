// `npm run dev`: Astro dev server (http://localhost:4321) + the /api functions on :4011 (proxied by Astro).
import './local/hooks.mjs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { handleApi } from './local/api.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
http.createServer((req, res) => handleApi(ROOT, req, res, new URL(req.url, 'http://localhost:4011')).catch((e) => { console.error(e); res.writeHead(500); res.end(); }))
  .listen(4011, () => console.log('[local] API on http://localhost:4011'));
spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['astro', 'dev'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
