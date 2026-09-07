import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5180/Jatek/';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.UI_BROWSER_PATH ? { executablePath: process.env.UI_BROWSER_PATH } : {}),
});
const output = new URL('../artifacts/ui-audit/', import.meta.url);
await mkdir(output, { recursive: true });
const report = { cards: 0, screens: 0, failures: [], consoleErrors: [] };
try {
  const context = await browser.newContext({ isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.consoleErrors.push(error.message));
  await page.goto(new URL('scripts/fixtures/layout.html', base).href);
  await page.waitForFunction(() => Boolean(window.renderFixture));
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  const cases = [
    [320, 568, null], [360, 640, null], [390, 844, null], [430, 932, null],
    [844, 390, '16:9'], [844, 390, '4:3'], [844, 390, '3:2'], [844, 390, '16:10'],
    [640, 480, '16:9'], [1280, 720, '4:3'], [1920, 1080, '16:9'],
  ];
  for (const [width, height, ratio] of cases) {
    await page.setViewportSize({ width, height });
    const result = await page.evaluate(async ({ ratio }) => {
      const failures = [];
      let nextTop;
      for (const card of window.auditCards) {
        window.renderFixture({ card, ratio });
        await new Promise(requestAnimationFrame);
        const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
        const content = document.querySelector('.game-card-content');
        const question = rect('.question-copy');
        const next = rect('.game-card-action-slot');
        const timer = rect('.timer-control');
        const frame = rect('.phone-frame');
        const reasons = [];
        if (content.scrollHeight > content.clientHeight + 2) reasons.push('clipped-card');
        if (question.top < rect('.game-card-top').bottom - 1) reasons.push('header-overlap');
        if (next.top < (timer?.bottom ?? question.bottom) + 3) reasons.push('action-overlap');
        if (next.bottom > frame.bottom) reasons.push('action-outside');
        if (nextTop !== undefined && Math.abs(nextTop - next.top) > 1) reasons.push('action-moved');
        nextTop = next.top;
        if (ratio && innerWidth > innerHeight) {
          const [w, h] = ratio.split(':').map(Number);
          if (Math.abs(frame.width / frame.height - w / h) > 0.005) reasons.push('wrong-ratio');
        }
        if (reasons.length) failures.push({ card: card.id, reasons });
      }
      return { total: window.auditCards.length, failures };
    }, { ratio });
    report.cards += result.total;
    report.failures.push(...result.failures.map((failure) => ({ width, height, ratio, ...failure })));
    for (const screen of ['home', 'players', 'modes', 'settings', 'room']) {
      await page.evaluate((args) => window.renderFixture(args), { screen, ratio });
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const issues = await page.evaluate(() => {
        const frame = document.querySelector('.phone-frame');
        return {
          overflow: frame.scrollWidth > frame.clientWidth + 2,
          collapsedScroll: [...document.querySelectorAll('.mobile-scroll')].some((element) => element.clientHeight < 40),
        };
      });
      report.screens += 1;
      if (issues.overflow || issues.collapsedScroll) report.failures.push({ width, height, ratio, screen, ...issues });
    }
    await page.evaluate((args) => window.renderFixture({ ...args, card: window.auditCards.find((card) => card.durationSeconds > 0) }), { ratio });
    await page.screenshot({ path: fileURLToPath(new URL(`${width}x${height}-${ratio?.replace(':', '-') || 'portrait'}.png`, output)) });
    console.log(`${width}x${height} ${ratio || 'portrait'}: ${result.total} cards, ${result.failures.length} failures`);
  }
  await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.failures, []);
  console.log(`PASS: ${report.cards} card layouts and ${report.screens} screens`);
} finally {
  await browser.close();
}
