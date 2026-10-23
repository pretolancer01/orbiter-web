import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('orbita', {
  backendUrl: (): Promise<string> => ipcRenderer.invoke('backend:url'),
  readSession: (): Promise<string|null> => ipcRenderer.invoke('session:read'),
  writeSession: (token:string): Promise<boolean> => ipcRenderer.invoke('session:write',token),
  clearSession: (): Promise<void> => ipcRenderer.invoke('session:clear'),
  openOAuth: (url:string): Promise<boolean> => ipcRenderer.invoke('oauth:open',url),
  sources: (): Promise<Array<{id:string; name:string}>> => ipcRenderer.invoke('capture:sources'),
  select: (id: string, audio: boolean): Promise<boolean> => ipcRenderer.invoke('capture:select', { id, audio }),
});
