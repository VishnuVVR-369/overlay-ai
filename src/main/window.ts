import { BrowserWindow, app, screen } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { IPC } from '@shared/ipc-channels'
import type { WindowMode } from '@shared/types'

const isDev = !app.isPackaged
const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL']
const RENDERER_FILE = join(__dirname, '../renderer/index.html')

export const COMPACT_SIZE = { width: 400, height: 148 }
export const NORMAL_SIZE = { width: 480, height: 640 }
export const WIDE_SIZE = { width: 780, height: 640 }

// Smallest → largest, so repeated presses grow the overlay and wrap around.
const SIZE_CYCLE: WindowMode[] = ['compact', 'normal', 'wide']

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

  win.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isAllowedNavigation(navigationUrl)) event.preventDefault()
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

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
    void win.loadFile(RENDERER_FILE)
  }

  return win
}

function isAllowedNavigation(navigationUrl: string): boolean {
  try {
    const candidate = new URL(navigationUrl)
    if (isDev && RENDERER_DEV_URL) {
      return candidate.origin === new URL(RENDERER_DEV_URL).origin
    }
    candidate.hash = ''
    candidate.search = ''
    return candidate.href === pathToFileURL(RENDERER_FILE).href
  } catch {
    return false
  }
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
    win.setMinimumSize(380, 340)
    const size = mode === 'wide' ? WIDE_SIZE : NORMAL_SIZE
    win.setSize(size.width, size.height, animate)
  }
  win.webContents.send(IPC.windowModeChanged, { mode })
}

export function cycleHudSize(win: BrowserWindow): void {
  const next = SIZE_CYCLE[(SIZE_CYCLE.indexOf(currentMode) + 1) % SIZE_CYCLE.length]
  setMode(win, next)
}
