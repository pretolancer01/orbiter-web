import { app, BrowserWindow, desktopCapturer, ipcMain, session, shell, safeStorage } from 'electron';
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

type PendingCapture = { id: string; audio: boolean; at: number };
const pending = new Map<number, PendingCapture>();

app.whenReady().then(() => {
  const dataDir = app.getPath('userData');
  require(path.join(__dirname, 'server.cjs')).startServer({ dataDir });
  const sessionPath = path.join(dataDir, 'session.bin');
  ipcMain.handle('backend:url', () => process.env.ORBITER_SERVER_URL || 'ws://127.0.0.1:8765');
  ipcMain.handle('session:read', () => {
    if (!safeStorage.isEncryptionAvailable() || !existsSync(sessionPath)) return null;
    try { return safeStorage.decryptString(readFileSync(sessionPath)); } catch { return null; }
  });
  ipcMain.handle('session:write', (_event, token: string) => {
    if (!safeStorage.isEncryptionAvailable() || typeof token !== 'string' || token.length > 100) return false;
    writeFileSync(sessionPath, safeStorage.encryptString(token), { mode: 0o600 }); return true;
  });
  ipcMain.handle('session:clear', () => { if (existsSync(sessionPath)) unlinkSync(sessionPath); });
  ipcMain.handle('oauth:open', (_event, url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'accounts.google.com') return false;
    void shell.openExternal(url); return true;
  });
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    const owner = BrowserWindow.getAllWindows().find(w => w.webContents.mainFrame === request.frame);
    if (!owner || !request.userGesture) return;
    const choice = pending.get(owner.webContents.id);
    pending.delete(owner.webContents.id);
    if (!choice || Date.now() - choice.at > 15000) return;
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } });
    const source = sources.find(item => item.id === choice.id);
    if (source) callback({ video: source, audio: choice.audio ? 'loopback' : undefined });
  });
  ipcMain.handle('capture:sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } });
    return sources.map(({ id, name }) => ({ id, name }));
  });
  ipcMain.handle('capture:select', (event, choice: { id: string; audio: boolean }) => {
    if (typeof choice?.id !== 'string' || choice.id.length > 200) return false;
    pending.set(event.sender.id, { id: choice.id, audio: choice.audio === true, at: Date.now() });
    return true;
  });
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 650,
    backgroundColor: '#101b24',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://discord.com/developers/')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
});

app.on('window-all-closed', () => app.quit());
