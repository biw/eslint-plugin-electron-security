import { contextBridge, ipcRenderer } from 'electron';

const raw = ipcRenderer;
const onMessage = (channel: string, callback: (event: unknown, payload: string) => void) => {
  ipcRenderer.on(channel, (event: unknown, payload: string) => callback(event, payload));
};

contextBridge.exposeInMainWorld('electron', {
  raw,
  on: ipcRenderer.on,
  onMessage,
});
