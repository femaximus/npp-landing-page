import puppeteer from '/home/felipedesousadacruzpereira/.npm/_npx/7d92d9a2d2ccc630/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || 'http://localhost:3001';
const label = process.argv[3] || '';

const screenshotsDir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

const existing = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
let maxN = 0;
for (const f of existing) {
  const m = f.match(/^screenshot-(\d+)/);
  if (m) maxN = Math.max(maxN, parseInt(m[1]));
}
const n = maxN + 1;
const filename = label ? `screenshot-${n}-${label}.png` : `screenshot-${n}.png`;
const outPath = path.join(screenshotsDir, filename);

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--single-process',
  ],
  timeout: 60000,
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

// Force all fade-up and card elements visible
await page.evaluate(() => {
  document.querySelectorAll('.fade-up').forEach(el => el.classList.add('visible'));
  document.querySelectorAll('.fail-card').forEach(el => el.classList.add('card-visible'));
});

// Scroll through to trigger any lazy loading
await page.evaluate(async () => {
  await new Promise(resolve => {
    let totalHeight = 0;
    const distance = 400;
    const timer = setInterval(() => {
      window.scrollBy(0, distance);
      totalHeight += distance;
      if (totalHeight >= document.body.scrollHeight) {
        clearInterval(timer);
        window.scrollTo(0, 0);
        setTimeout(resolve, 500);
      }
    }, 80);
  });
});

await new Promise(r => setTimeout(r, 600));

// Lock vh-dependent heights before resizing viewport (prevents hero from expanding)
const currentVh = await page.evaluate(() => window.innerHeight);
await page.addStyleTag({ content: `
  .hero-section { min-height: ${currentVh}px !important; }
  section { min-height: 0 !important; }
` });

// Resize viewport to full page height to avoid fullPage tiling bug
const pageHeight = await page.evaluate(() => document.body.scrollHeight);
await page.setViewport({ width: 1440, height: pageHeight });
await new Promise(r => setTimeout(r, 300));
await page.evaluate(() => window.scrollTo(0, 0));

await page.screenshot({ path: outPath, fullPage: false });
await browser.close();

console.log(`Screenshot saved: ${outPath}`);
