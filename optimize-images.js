// Run once: node optimize-images.js
// Requires: npm install sharp
//
// Converts avatar.jpeg, icon-192.png, icon-512.png → WebP
// Output files land next to originals with .webp extension.

import sharp from 'sharp';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const jobs = [
  {
    input:  'avatar.jpeg',
    output: 'avatar.webp',
    options: { quality: 82 },        // good quality for a profile photo
  },
  {
    input:  'icon-192.png',
    output: 'icon-192.webp',
    options: { quality: 90, lossless: false },
  },
  {
    input:  'icon-512.png',
    output: 'icon-512.webp',
    options: { quality: 90, lossless: false },
  },
];

(async () => {
  for (const job of jobs) {
    const src  = path.join(__dirname, job.input);
    const dest = path.join(__dirname, job.output);

    if (!existsSync(src)) {
      console.warn(`⚠️  Skipping ${job.input} — file not found`);
      continue;
    }

    try {
      const info = await sharp(src).webp(job.options).toFile(dest);
      console.log(`✅ ${job.input} → ${job.output} (${(info.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`❌ Failed on ${job.input}:`, err.message);
    }
  }

  console.log('\nDone! Update your HTML image tags:');
  console.log('  avatar.jpeg   →  avatar.webp');
  console.log('  icon-192.png  →  icon-192.webp');
  console.log('  icon-512.png  →  icon-512.webp');
  console.log('\nOr use <picture> for graceful fallback:');
  console.log(`
  <picture>
    <source srcset="avatar.webp" type="image/webp">
    <img src="avatar.jpeg" alt="Stain">
  </picture>
  `);
})();
