import { _electron as electron } from 'playwright-core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const profile = await mkdtemp(join(tmpdir(), 'orbiter-desktop-smoke-'));
let app;
try {
  app = await electron.launch({
    executablePath: resolve('dist/win-unpacked/Orbiter.exe'),
    args: [`--user-data-dir=${profile}`],
    env: { ...process.env, ORBITER_SERVER_URL: '', ORBITER_LOCAL_SERVER: '' },
    timeout: 30000,
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.evaluate(() => window.orbita.backendUrl()), 'wss://orbiter-web.onrender.com');
  const iconLoaded = await page.locator('#loading img').evaluate(img => img.complete && img.naturalWidth > 0);
  assert.equal(iconLoaded, true, 'Ícone do Orbiter não carregou no desktop');
  const config = await page.evaluate(() => window.orbita.iceConfig());
  assert.ok(config.iceServers?.some(server => [server.urls].flat().some(url => url.startsWith('turn:') || url.startsWith('turns:'))));
  await page.locator('#auth').waitFor({ state: 'visible', timeout: 100000 });
  await page.addInitScript(() => { const Native = WebSocket; window.__testSockets = []; window.WebSocket = class extends Native { constructor(...args) { super(...args); window.__testSockets.push(this); } }; });
  await page.reload();
  await page.locator('#auth-submit').waitFor({ state: 'visible', timeout: 100000 });
  await page.waitForFunction(() => !document.querySelector('#auth-submit').disabled);
  await page.evaluate(() => window.__testSockets.at(-1).close());
  await page.waitForFunction(() => document.querySelector('#auth-submit').disabled);
  await page.waitForFunction(() => !document.querySelector('#auth-submit').disabled, undefined, { timeout: 30000 });
  console.log('Desktop online: URL, ícone, TURN, login e reconexão confirmados.');
} finally {
  if (app) await app.close();
  await rm(profile, { recursive: true, force: true });
}
