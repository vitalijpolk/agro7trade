// Збирає PDF-прайс з даних сайту: склад рядків — src/data/price-list.ts,
// ціни, ФАО, вегетація, вовчок — з карток товарів (src/data/hybrids.ts).
// Запуск: node scripts/build-price-pdf.mjs [шлях-виводу.pdf]
//   без аргументу → public/files/prais-agro7trade-2026.pdf

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  RESOLVED_PRICE_LIST, PRICE_LIST_PDF, PRICE_LIST_UPDATED, MANUFACTURER, formatPrice,
} from '../src/data/price-list.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

const cellHtml = (c) =>
  c.kind === 'covered' ? ''
  : c.kind === 'merged' ? `<td class="num merged" rowspan="${c.rowspan}">${formatPrice(c.value)}</td>`
  : c.kind === 'single' ? `<td class="num" colspan="${c.colspan}">${formatPrice(c.value)}</td>`
  : `<td class="num">${formatPrice(c.value)}</td>`;

function tableHtml(t) {
  const isCorn = t.crop === 'kukurudza';
  const head = isCorn
    ? ['Назва гібриду', 'ФАО', 'Виробник']
    : ['Назва гібриду', 'Вегетаційний період, днів', 'Стійкість до вовчка', 'Виробник'];
  const cols = head.length + t.tiers.length;
  const priceHead = t.tiers.length > 1
    ? `<th colspan="${t.tiers.length}">Ціна, грн/п.о.</th></tr><tr>${t.tiers.map((x) => `<th class="sub">${esc(x)}</th>`).join('')}`
    : `<th>Ціна, грн/п.о.</th>`;
  const rowspan = t.tiers.length > 1 ? ' rowspan="2"' : '';
  const body = t.groups.map((g) =>
    (g.title ? `<tr class="group"><td colspan="${cols}">${esc(g.title)}</td></tr>` : '') +
    g.rows.map((r) => {
      const name = esc(r.name.toUpperCase()) + (r.note ? ` <span class="note">(${esc(r.note)})</span>` : '');
      const meta = isCorn ? [r.fao, MANUFACTURER] : [r.vegetation ?? '—', r.broomrape ?? '—', MANUFACTURER];
      return `<tr><td class="name">${name}</td>${meta.map((m) => `<td>${esc(m)}</td>`).join('')}${r.cells.map(cellHtml).join('')}</tr>`;
    }).join(''),
  ).join('');
  return `
  <h2>${esc(t.title.toUpperCase())} РОКУ</h2>
  <table>
    <thead><tr>${head.map((h) => `<th${rowspan}>${h}</th>`).join('')}${priceHead}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  <p class="pack">${esc(t.packaging)}</p>`;
}

const logo = pathToFileURL(path.join(root, 'src/assets/images/logo.png')).href;
const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>Прайс Agro7Trade 2026</title>
<style>
  @page { size: A4; margin: 14mm 12mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, 'Segoe UI', sans-serif; color: #1a1a1a; margin: 0; font-size: 11pt; }
  .top { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2f6fed; padding-bottom: 10px; }
  .top img { height: 58px; }
  .top .meta { text-align: right; font-size: 9.5pt; color: #555; line-height: 1.5; }
  .top .meta b { color: #1a1a1a; font-size: 14pt; }
  h2 { text-align: center; font-size: 13pt; margin: 24px 0 10px; color: #1d4fc4; letter-spacing: .02em; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th, td { border: 1px solid #b9c3d9; padding: 6px 7px; text-align: center; }
  th { background: #2f6fed; color: #fff; font-weight: 700; }
  th.sub { background: #dbe6fd; color: #1d4fc4; font-weight: 700; }
  td.name { text-align: left; font-weight: 700; }
  td.num { font-variant-numeric: tabular-nums; font-weight: 700; }
  td.merged { font-size: 12pt; vertical-align: middle; background: #f4f6fb; }
  .note { font-weight: 400; color: #555; font-size: 9pt; }
  tr.group td { background: #e8eefb; color: #1d4fc4; font-weight: 700; text-align: left; }
  .pack { font-size: 9.5pt; color: #333; margin: 8px 0 0; padding: 7px 10px; background: #f0f2f5; border-radius: 4px; }
  .foot { position: fixed; bottom: 0; left: 0; right: 0; border-top: 2px solid #1c1c1c; padding-top: 6px; display: flex; justify-content: space-between; font-size: 9pt; color: #333; }
</style></head><body>
  <div class="top">
    <img src="${logo}" alt="Agro7Trade">
    <div class="meta"><b>Прайс на насіння 2026</b><br>Ціни дійсні з ${PRICE_LIST_UPDATED}</div>
  </div>
  ${RESOLVED_PRICE_LIST.map(tableHtml).join('')}
  <div class="foot">
    <span>+38 (099) 452-79-49 · +38 (097) 312-53-18</span>
    <span>agro7trade.ua@gmail.com</span>
    <span>agro7trade.com.ua</span>
  </div>
</body></html>`;

const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'public', PRICE_LIST_PDF);
fs.mkdirSync(path.dirname(out), { recursive: true });
const tmpHtml = path.join(root, 'scripts', '.price-list.html');
const tmpPdf = path.join(root, 'scripts', '.price-list.pdf');
fs.writeFileSync(tmpHtml, html);

const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));
if (!chrome) throw new Error('Не знайдено Chrome для друку PDF');

// Друкуємо в тимчасовий файл, потім копіюємо: якщо PDF відкритий у переглядачі, Windows не дасть його перезаписати.
fs.rmSync(tmpPdf, { force: true });
try {
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${tmpPdf}`, pathToFileURL(tmpHtml).href], { stdio: 'ignore' });
} finally {
  fs.rmSync(tmpHtml, { force: true });
}
if (!fs.existsSync(tmpPdf)) throw new Error('Chrome не створив PDF');
try {
  fs.copyFileSync(tmpPdf, out);
} catch (e) {
  console.error(e.code === 'EBUSY' || e.code === 'EPERM'
    ? `❌ ${out} відкритий в іншій програмі — закрийте PDF і запустіть знову.`
    : `❌ Не вдалося записати ${out}: ${e.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(tmpPdf, { force: true });
}
if (!process.exitCode) console.log(`✅ PDF: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
