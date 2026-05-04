import { BrowserWindow, app, screen } from 'electron'
import { join } from 'node:path'

const isDev = !app.isPackaged
const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL']

export function createOverlayWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const { width } = display.workAreaSize

  const win = new BrowserWindow({
    width: 480,
    height: 720,
    x: width - 500,
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
  if (win.isVisible()) win.hide()
  else win.showInactive()
}

export const COMPACT_SIZE = { width: 260, height: 44 }
export const EXPANDED_SIZE = { width: 480, height: 720 }

export function setCompact(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  win.setMinimumSize(COMPACT_SIZE.width, COMPACT_SIZE.height)
  win.setResizable(false)
  win.setSize(COMPACT_SIZE.width, COMPACT_SIZE.height, process.platform === 'darwin')
}

export function setExpanded(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  win.setResizable(true)
  win.setMinimumSize(360, 320)
  win.setSize(EXPANDED_SIZE.width, EXPANDED_SIZE.height, process.platform === 'darwin')
}
