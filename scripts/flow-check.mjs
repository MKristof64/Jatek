import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5180/Jatek/';
const browser = await chromium.launch({ headless: true, executablePath: process.env.UI_BROWSER_PATH });
const output = new URL('../artifacts/ui-audit/', import.meta.url);
await mkdir(output, { recursive: true });
const errors = [];
const makePage = async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await context.route('**/api/cards?**', (route) => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy|Refused to/.test(message.text())) {
      errors.push(message.text());
    }
  });
  await page.goto(base);
  return page;
};
const openRoom = async (page) => {
  await page.getByRole('button', { name: 'Játékosok', exact: true }).click();
  await page.getByRole('button', { name: 'Szoba', exact: true }).click();
};
let page;
let guest;
try {
  page = await makePage();
  await page.getByRole('button', { name: 'Beállítások', exact: true }).click();
  for (const name of [/Játék mentése/, /Páros kártyák/, /Körbemenős/]) {
    await page.getByRole('switch', { name }).click();
  }
  await page.getByRole('button', { name: 'Vissza', exact: true }).click();
  await page.getByRole('button', { name: 'Játékosok', exact: true }).click();
  for (const name of ['Alex', 'Kriszti', 'alex']) {
    await page.getByPlaceholder('Játékos neve').fill(name);
    await page.getByPlaceholder('Játékos neve').press('Enter');
  }
  assert.match(await page.getByRole('alert').innerText(), /már szerepel/);
  await page.getByRole('button', { name: 'Tovább a módokhoz' }).click();
  await page.getByRole('button', { name: 'Kezdés', exact: true }).click();
  for (let i = 0; i < 20; i++) await page.getByRole('button', { name: 'Következő' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('enmegsosem.savedGames.v1'))[0]);
  assert.equal(saved.playedCards.length, 21);
  assert.equal(new Set(saved.game.usedIds).size, 21);
  assert.deepEqual([...new Set(saved.playedCards.map((card) => card.kind))], ['never']);
  const cardText = await page.locator('.question-sentence').innerText();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Játéknézet beállítása' }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: /^4:3,/ }).click();
  const ratio = await page.locator('.phone-frame').evaluate((element) => element.clientWidth / element.clientHeight);
  assert.ok(Math.abs(ratio - 4 / 3) < 0.005);
  await page.getByRole('button', { name: /^4:3,/ }).click();
  assert.equal(await page.locator('.app-landscape-layout').count(), 0);
  await page.getByRole('button', { name: 'Mégse', exact: true }).click();
  assert.equal(await page.locator('.question-sentence').innerText(), cardText);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Kilépés', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /Korábbi játékok/ }).click();
  await page.getByRole('button', { name: 'Játék folytatása' }).click();
  assert.equal(await page.locator('.question-sentence').innerText(), cardText);
  await page.getByRole('button', { name: 'Következő' }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('button', { name: 'Következő' }).evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Kilépés', exact: true }).click();
  console.log('PASS: players, filters, no repetition, saved resume, ratio toggle, keyboard focus');

  if (process.env.UI_TEST_ONLINE === '1') {
    await openRoom(page);
    await page.getByLabel('Házigazda neve').fill('Ellenorzes');
    await page.getByRole('button', { name: 'Kód generálása' }).click();
    await page.getByText('Online szoba aktív', { exact: false }).waitFor({ timeout: 20000 });
    const code = await page.locator('.room-card .text-4xl').innerText();
    console.log('Online host ready');
    guest = await makePage();
    await openRoom(guest);
    await guest.getByLabel('Szobakód').fill(code);
    await guest.getByLabel('Játékos neve', { exact: true }).fill('Teszt vendeg');
    await guest.getByRole('button', { name: 'Belépés', exact: true }).click();
    await guest.getByText('Belépve: Teszt vendeg').waitFor({ timeout: 20000 });
    console.log('Online guest connected');
    await page.getByRole('button', { name: 'Kezdés', exact: true }).click();
    await page.getByRole('button', { name: 'Kezdés', exact: true }).click();
    await guest.locator('.question-sentence').waitFor();
    assert.equal(await guest.getByRole('button', { name: 'Következő' }).count(), 0);
    const firstCard = await page.locator('.question-sentence').innerText();
    assert.equal(await guest.locator('.question-sentence').innerText(), firstCard);
    if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Mégse', exact: true }).click();
    await page.getByRole('button', { name: 'Következő' }).click();
    await guest.waitForFunction((previous) => document.querySelector('.question-sentence')?.textContent !== previous, firstCard);
    assert.equal(await guest.locator('.question-sentence').innerText(), await page.locator('.question-sentence').innerText());
    console.log('PASS: online host/guest synchronization and read-only guest');
  }
  assert.deepEqual(errors, []);
} catch (error) {
  for (const [name, target] of [['host', page], ['guest', guest]]) {
    if (target) {
      console.error(name, await target.locator('body').innerText());
      await target.screenshot({ path: fileURLToPath(new URL(`flow-failure-${name}.png`, output)) });
    }
  }
  throw error;
} finally {
  await browser.close();
}
