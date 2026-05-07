#!/usr/bin/env node
// app/scripts/generate-a2hs-placeholders.mjs
//
// Generates 6 placeholder PNGs for the iOS Add-to-Home-Screen overlay:
//   public/a2hs/en/step-{1,2,3}.png  — English iOS Safari mockups
//   public/a2hs/th/step-{1,2,3}.png  — Thai iOS Safari mockups
//
// These are PLACEHOLDERS — clearly labeled illustrations, not real iOS screenshots.
// They serve their purpose (teach the user where to tap) without requiring Tew
// to capture real iOS screenshots on two language settings of his phone.
//
// To regenerate (e.g. after copy changes):
//   cd app && node scripts/generate-a2hs-placeholders.mjs
//
// Or run via npm: npm run generate:a2hs

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, '..');
const OUT_DIR = join(APP_ROOT, 'public', 'a2hs');

const COPY = {
  en: {
    step1: { title: 'Step 1', text: 'Tap the Share button', label: 'Share', sublabel: 'In Safari toolbar' },
    step2: { title: 'Step 2', text: 'Tap Add to Home Screen', label: 'Add to Home Screen', sublabel: 'In the share sheet' },
    step3: { title: 'Step 3', text: 'Tap Add', label: 'Add', sublabel: 'Top right corner' },
  },
  th: {
    step1: { title: 'ขั้นตอน 1', text: 'แตะปุ่ม แชร์', label: 'แชร์', sublabel: 'ในแถบเครื่องมือ Safari' },
    step2: { title: 'ขั้นตอน 2', text: "แตะ 'เพิ่มไปที่หน้าจอโฮม'", label: 'เพิ่มไปที่หน้าจอโฮม', sublabel: 'ในชีตแชร์' },
    step3: { title: 'ขั้นตอน 3', text: "แตะ 'เพิ่ม'", label: 'เพิ่ม', sublabel: 'มุมขวาบน' },
  },
};

function html({ lang, step }) {
  const c = COPY[lang][`step${step}`];
  const fontStack = lang === 'th'
    ? `'Noto Sans Thai', 'Inter', system-ui, sans-serif`
    : `'Inter', system-ui, sans-serif`;
  // Each step has a distinctive iOS-mimicking visual:
  //   step 1 → Safari with bottom toolbar, share icon highlighted
  //   step 2 → Share sheet bottom modal, "Add to Home Screen" row highlighted
  //   step 3 → Add to Home Screen sheet with Cancel / Add buttons
  let visual;
  if (step === 1) {
    visual = `
      <div class="phone-screen">
        <div class="status-bar">9:41</div>
        <div class="addr-bar">
          <span class="aA">aA</span>
          <span class="url">dashboard.omnicai.online</span>
          <span class="refresh">↻</span>
        </div>
        <div class="page-content">${lang === 'th' ? '...เนื้อหาหน้าเว็บ...' : '...page content...'}</div>
        <div class="bottom-toolbar">
          <span class="tb-icon">‹</span>
          <span class="tb-icon">›</span>
          <span class="tb-icon highlight" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><rect x="4" y="13" width="16" height="8" rx="2"/></svg>
          </span>
          <span class="tb-icon">⌘</span>
          <span class="tb-icon">▭</span>
        </div>
        <div class="caret"></div>
      </div>`;
  } else if (step === 2) {
    visual = `
      <div class="phone-screen dim">
        <div class="share-sheet">
          <div class="grab"></div>
          <div class="share-row icons">
            <span class="icon">⎘</span><span class="icon">✉</span><span class="icon">⌧</span>
          </div>
          <div class="share-row item">${lang === 'th' ? 'คัดลอก' : 'Copy'}</div>
          <div class="share-row item">${lang === 'th' ? 'เพิ่มในรายการอ่าน' : 'Add to Reading List'}</div>
          <div class="share-row item highlight">
            <span class="row-icon">+</span>
            <span>${c.label}</span>
            <span class="caret">›</span>
          </div>
          <div class="share-row item">${lang === 'th' ? 'ค้นหาในหน้า' : 'Find on Page'}</div>
        </div>
      </div>`;
  } else {
    visual = `
      <div class="phone-screen">
        <div class="add-bar">
          <span class="add-cancel">${lang === 'th' ? 'ยกเลิก' : 'Cancel'}</span>
          <span class="add-title">${lang === 'th' ? 'เพิ่มไปที่หน้าจอโฮม' : 'Add to Home Screen'}</span>
          <span class="add-confirm highlight">${c.label}</span>
        </div>
        <div class="add-card">
          <div class="add-icon">CC</div>
          <div class="add-name">Content Calendar</div>
          <div class="add-url">dashboard.omnicai.online</div>
        </div>
        <div class="add-hint">${lang === 'th' ? 'แอปจะปรากฏบนหน้าจอโฮม' : 'An icon will be added to your Home Screen.'}</div>
      </div>`;
  }
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${fontStack}; background: #F1F3F5; padding: 24px; }
  .frame { width: 240px; height: 400px; background: #fff; border-radius: 24px; padding: 16px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border: 1px solid #E9ECEF; position: relative; overflow: hidden; }
  .step-num { position: absolute; top: 8px; left: 12px; background: #2563EB; color: #fff; width: 26px; height: 26px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; box-shadow: 0 2px 6px rgba(37,99,235,0.4); }
  .caption { font-size: 12px; font-weight: 600; color: #212529; text-align: center; padding-top: 18px; line-height: 1.3; }
  .phone-screen { flex: 1; background: #fff; border-radius: 12px; border: 1px solid #E9ECEF; padding: 8px 6px; display: flex; flex-direction: column; font-size: 9px; color: #495057; gap: 6px; position: relative; overflow: hidden; }
  .phone-screen.dim { background: rgba(60,60,67,0.55); }
  .status-bar { font-size: 8px; font-weight: 600; color: #212529; text-align: center; padding: 2px 0; }
  .addr-bar { background: #F1F3F5; border-radius: 8px; display: flex; align-items: center; gap: 4px; padding: 4px 6px; font-size: 8px; }
  .addr-bar .aA { color: #6C757D; font-size: 7px; }
  .addr-bar .url { flex: 1; color: #212529; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .addr-bar .refresh { color: #6C757D; }
  .page-content { flex: 1; background: #F8F9FA; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #ADB5BD; font-style: italic; }
  .bottom-toolbar { display: flex; justify-content: space-around; align-items: center; padding: 6px 4px; background: #F1F3F5; border-radius: 8px; gap: 2px; position: relative; }
  .tb-icon { font-size: 13px; color: #2563EB; padding: 2px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; }
  .tb-icon.highlight { background: rgba(37,99,235,0.15); border: 2px solid #2563EB; transform: scale(1.15); padding: 4px; box-shadow: 0 0 0 4px rgba(37,99,235,0.2); }
  .caret { display: none; }
  .share-sheet { background: #fff; border-top-left-radius: 14px; border-top-right-radius: 14px; padding: 10px 12px; margin-top: auto; box-shadow: 0 -4px 16px rgba(0,0,0,0.15); }
  .grab { width: 32px; height: 4px; background: #DEE2E6; border-radius: 9999px; margin: 0 auto 8px; }
  .share-row { padding: 6px 4px; font-size: 9px; color: #212529; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .share-row.icons { gap: 8px; padding: 4px 0 8px; border-bottom: 1px solid #F1F3F5; justify-content: flex-start; }
  .share-row .icon { background: #F1F3F5; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 12px; }
  .share-row.item { border-bottom: 1px solid #F1F3F5; padding: 7px 6px; }
  .share-row.item:last-child { border-bottom: none; }
  .share-row.highlight { background: rgba(37,99,235,0.12); border: 2px solid #2563EB; border-radius: 8px; font-weight: 600; color: #1D4ED8; }
  .share-row .row-icon { background: #2563EB; color: #fff; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; border-radius: 5px; font-size: 13px; font-weight: 700; }
  .share-row .caret { color: #ADB5BD; }
  .add-bar { display: flex; justify-content: space-between; align-items: center; padding: 6px 4px; border-bottom: 1px solid #E9ECEF; font-size: 9px; }
  .add-cancel { color: #2563EB; }
  .add-title { font-weight: 600; color: #212529; }
  .add-confirm { color: #2563EB; font-weight: 600; padding: 4px 10px; border-radius: 6px; }
  .add-confirm.highlight { background: #2563EB; color: #fff; box-shadow: 0 0 0 4px rgba(37,99,235,0.25); transform: scale(1.08); }
  .add-card { background: #F8F9FA; border-radius: 10px; padding: 10px; display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .add-icon { width: 36px; height: 36px; background: #2563EB; color: #fff; font-weight: 700; font-size: 11px; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
  .add-name { font-size: 10px; font-weight: 600; color: #212529; }
  .add-url { font-size: 8px; color: #6C757D; }
  .add-hint { font-size: 8px; color: #6C757D; text-align: center; padding: 6px; line-height: 1.3; }
</style>
</head>
<body>
  <div class="frame">
    <div class="step-num">${step}</div>
    <div class="caption">${c.text}</div>
    ${visual}
  </div>
</body>
</html>`;
}

async function main() {
  // Ensure output dirs
  await mkdir(join(OUT_DIR, 'en'), { recursive: true });
  await mkdir(join(OUT_DIR, 'th'), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 280, height: 440 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  for (const lang of ['en', 'th']) {
    for (const step of [1, 2, 3]) {
      await page.setContent(html({ lang, step }), { waitUntil: 'networkidle' });
      // Wait for fonts
      await page.evaluate(() => document.fonts.ready);
      const el = await page.locator('.frame');
      const out = join(OUT_DIR, lang, `step-${step}.png`);
      await el.screenshot({ path: out, type: 'png', omitBackground: false });
      console.log(`✓ ${out}`);
    }
  }

  await browser.close();
  console.log(`\nDone. 6 PNGs written to ${OUT_DIR}/{en,th}/.`);
  console.log('These are placeholder illustrations — replace with real iOS Safari screenshots in production if a non-Thai client signs up.');
}

main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
