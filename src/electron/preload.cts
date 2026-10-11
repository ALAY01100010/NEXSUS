// Made by Alay
import { contextBridge, ipcRenderer } from 'electron';
import type { NexsusApi } from '../shared/contracts.js';

const api: NexsusApi = {
  version: process.env.npm_package_version ?? '0.1.0',
  providers: { list: () => ipcRenderer.invoke('providers:list') },
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    create: (providerId, displayName) => ipcRenderer.invoke('accounts:create', providerId, displayName),
    rename: (id, displayName) => ipcRenderer.invoke('accounts:rename', id, displayName),
    remove: (id) => ipcRenderer.invoke('accounts:remove', id),
    activate: (id) => ipcRenderer.invoke('accounts:activate', id),
    favorite: (id, isFavorite) => ipcRenderer.invoke('accounts:favorite', id, isFavorite),
    move: (id, direction) => ipcRenderer.invoke('accounts:move', id, direction),
    clearSession: (id) => ipcRenderer.invoke('accounts:clear-session', id),
  },
  capsules: {
    list: () => ipcRenderer.invoke('capsules:list'),
    create: (input) => ipcRenderer.invoke('capsules:create', input),
    update: (id, input) => ipcRenderer.invoke('capsules:update', id, input),
    remove: (id) => ipcRenderer.invoke('capsules:remove', id),
    duplicate: (id) => ipcRenderer.invoke('capsules:duplicate', id),
    versions: (id) => ipcRenderer.invoke('capsules:versions', id),
    createVersion: (id, input) => ipcRenderer.invoke('capsules:create-version', id, input),
    restoreVersion: (id) => ipcRenderer.invoke('capsules:restore-version', id),
    copy: (id) => ipcRenderer.invoke('capsules:copy', id),
    export: (id) => ipcRenderer.invoke('capsules:export', id),
    import: () => ipcRenderer.invoke('capsules:import'),
    inject: (id, accountId) => ipcRenderer.invoke('capsules:inject', id, accountId),
  },
  browser: {
    back: () => ipcRenderer.send('browser:back'),
    forward: () => ipcRenderer.send('browser:forward'),
    reload: () => ipcRenderer.send('browser:reload'),
    stop: () => ipcRenderer.send('browser:stop'),
    navigate: (url) => ipcRenderer.send('browser:navigate', url),
    openExternally: () => ipcRenderer.send('browser:open-external'),
    setOverlayOpen: (isOpen) => ipcRenderer.send('browser:overlay', isOpen),
    updateBounds: (bounds) => ipcRenderer.send('browser:bounds', bounds),
    extractCapsule: () => ipcRenderer.invoke('browser:extract-capsule'),
    onState: (callback) => subscribe('browser:state', callback),
  },
  onAccountsChanged: (callback) => subscribe('accounts:changed', callback),
  onCapsulesChanged: (callback) => subscribe('capsules:changed', callback),
  onError: (callback) => subscribe('app:error', callback),
};

contextBridge.exposeInMainWorld('nexsus', api);

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
