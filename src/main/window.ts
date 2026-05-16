import { BrowserWindow, app, screen } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc-channels'
import type { WindowMode } from '@shared/types'

const isDev = !app.isPackaged
const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL']

export const COMPACT_SIZE = { width: 360, height: 120 }
export const NORMAL_SIZE = { width: 460, height: 620 }
export const WIDE_SIZE = { width: 760, height: 620 }

let currentMode: WindowMode = 'normal'

export function createOverlayWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const { width } = display.workAreaSize

  const win = new BrowserWindow({
    width: NORMAL_SIZE.width,
    height: NORMAL_SIZE.height,
    x: width - NORMAL_SIZE.width - 24,
    y: 60,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    resizable: true,
    movable: true,
    backgroundColor: '#00000000',
    type: process.platform === 'darwin' ? 'panel' : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.setContentProtection(true)
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.platform === 'darwin') {
    win.setHiddenInMissionControl(true)
    try {
      win.setWindowButtonVisibility?.(false)
    } catch {
      // not all window types support this
    }
  }

  win.on('blur', () => {
    if (!win.isDestroyed()) win.webContents.send(IPC.windowFocusState, { focused: false })
  })
  win.on('focus', () => {
    if (!win.isDestroyed()) win.webContents.send(IPC.windowFocusState, { focused: true })
  })

  win.once('ready-to-show', () => win.showInactive())

  if (isDev && RENDERER_DEV_URL) {
    void win.loadURL(RENDERER_DEV_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

export function toggleWindowVisibility(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  if (win.isVisible()) {
    win.webContents.send(IPC.windowVisibilityChanged, { visible: false })
    win.hide()
  } else {
    win.showInactive()
    win.webContents.send(IPC.windowVisibilityChanged, { visible: true })
  }
}

export function hideWindow(win: BrowserWindow): void {
  if (win.isDestroyed() || !win.isVisible()) return
  win.webContents.send(IPC.windowVisibilityChanged, { visible: false })
  win.hide()
}

export function getMode(): WindowMode {
  return currentMode
}

export function setMode(win: BrowserWindow, mode: WindowMode): void {
  if (win.isDestroyed()) return
  currentMode = mode
  const animate = process.platform === 'darwin'
  if (mode === 'compact') {
    win.setMinimumSize(COMPACT_SIZE.width, COMPACT_SIZE.height)
    win.setResizable(false)
    win.setSize(COMPACT_SIZE.width, COMPACT_SIZE.height, animate)
  } else {
    win.setResizable(true)
    win.setMinimumSize(360, 320)
    const size = mode === 'wide' ? WIDE_SIZE : NORMAL_SIZE
    win.setSize(size.width, size.height, animate)
  }
  win.webContents.send(IPC.windowModeChanged, { mode })
}

export function toggleWide(win: BrowserWindow): void {
  if (currentMode === 'compact') return
  setMode(win, currentMode === 'wide' ? 'normal' : 'wide')
}
