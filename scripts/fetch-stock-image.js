// Stock photos from Openverse (CC0 / Public Domain only).
//   node scripts/fetch-stock-image.js search "<query>"
//   node scripts/fetch-stock-image.js get <slug> <id> [name]
// <slug> = a post slug → src/content/posts/<slug>-<name|cover>.jpg
// <slug> = "_assets"   → src/assets/images/<name>.jpg (site-wide images)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.openverse.org/v1/images/';
const UA = 'Agro7Trade/1.0 (+https://agro7trade.com.ua)';
const PREVIEW_DIR = path.join(ROOT, 'scripts', '.stock-preview');
const CREDITS = path.join(ROOT, 'scripts', 'image-credits.json');
const ALLOWED = new Set(['cc0', 'pdm']);

async function fetchOk(url, asJson = false) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return asJson ? res.json() : Buffer.from(await res.arrayBuffer());
}

// Wikimedia rate-limits full originals (429) and only serves standard thumbnail
// widths, so request its thumbnails at those widths instead of the original.
function candidates(url, widths) {
  const m = url.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(\w)\/(\w\w)\/([^/]+)$/);
  if (!m) return [url];
  const [, a, ab, file] = m;
  return widths.map((w) => `https://upload.wikimedia.org/wikipedia/commons/thumb/${a}/${ab}/${file}/${w}px-${file}`);
}

async function fetchFirst(urls) {
  let last;
  for (const u of urls) {
    try { return await fetchOk(u); } catch (e) { last = e; }
  }
  throw last;
}

const plain = (s) => (s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

async function search(q) {
  const base = { q, license: 'cc0,pdm', page_size: '12' };
  let data = await fetchOk(API + '?' + new URLSearchParams({ ...base, aspect_ratio: 'wide', size: 'large' }), true);
  if (data.results.length < 4) data = await fetchOk(API + '?' + new URLSearchParams(base), true);

  await fs.mkdir(PREVIEW_DIR, { recursive: true });
  for (const [i, r] of data.results.entries()) {
    const n = String(i + 1).padStart(2, '0');
    console.log(`${n}  ${r.id}  ${r.width ?? '?'}x${r.height ?? '?'}  ${r.source}  "${plain(r.title)}"  by ${plain(r.creator) || '—'}`);
    let buf;
    try { buf = await fetchFirst([r.thumbnail, ...candidates(r.url, [500, 960])]); } catch { /* reported below */ }
    if (buf) await sharp(buf).resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 75 }).toFile(path.join(PREVIEW_DIR, `${n}-${r.id}.jpg`));
    else console.log('    preview failed');
  }
  console.log(`\nPreviews: ${PREVIEW_DIR}`);
}

async function get(slug, id, name) {
  if (!slug || !id) throw new Error('usage: get <slug> <id> [name]');
  const r = await fetchOk(`${API}${id}/`, true);
  if (!ALLOWED.has(r.license)) throw new Error(`license "${r.license}" is not cc0/pdm — refusing`);

  const buf = await fetchFirst(candidates(r.url, [1920, 1280]));
  const out = slug === '_assets'
    ? path.join(ROOT, 'src', 'assets', 'images', `${name ?? id}.jpg`)
    : path.join(ROOT, 'src', 'content', 'posts', `${slug}-${name ?? 'cover'}.jpg`);
  const info = await sharp(buf).rotate().resize({ width: 1536, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(out);

  let credits = [];
  try { credits = JSON.parse(await fs.readFile(CREDITS, 'utf8')); } catch { /* first run */ }
  const file = path.relative(ROOT, out).replaceAll('\\', '/');
  credits = credits.filter((c) => c.file !== file);
  credits.push({
    file, id: r.id, title: plain(r.title), creator: plain(r.creator), source: r.source,
    license: r.license, license_url: r.license_url, original: r.foreign_landing_url,
    downloaded: new Date().toISOString().slice(0, 10),
  });
  await fs.writeFile(CREDITS, JSON.stringify(credits, null, 2) + '\n');
  console.log(`saved ${file} (${info.width}x${info.height}), license ${r.license}, ${r.source}`);
}

const [cmd, ...args] = process.argv.slice(2);
try {
  if (cmd === 'search') await search(args.join(' '));
  else if (cmd === 'get') await get(...args);
  else console.log('usage: search "<query>" | get <slug> <id> [name]');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
