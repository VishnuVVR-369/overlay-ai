import { describe, expect, it, vi, beforeEach } from 'vitest'

interface FakeThumb {
  isEmpty: () => boolean
  toDataURL: () => string
  getSize: () => { width: number; height: number }
}

interface FakeSource {
  display_id: string
  thumbnail: FakeThumb
}

const desktopState: { sources: FakeSource[]; lastOpts?: { types: string[]; thumbnailSize: { width: number; height: number } } } = {
  sources: [],
}

const screenState: { displays: Array<{ id: number; size: { width: number; height: number }; scaleFactor: number }>; cursor: { x: number; y: number } } = {
  displays: [],
  cursor: { x: 100, y: 100 },
}

vi.mock('electron', () => ({
  desktopCapturer: {
    getSources: async (opts: { types: string[]; thumbnailSize: { width: number; height: number } }) => {
      desktopState.lastOpts = opts
      return desktopState.sources
    },
  },
  screen: {
    getCursorScreenPoint: () => screenState.cursor,
    getDisplayNearestPoint: () => screenState.displays[0],
    getPrimaryDisplay: () => screenState.displays[0],
  },
}))

const goodThumb = (w: number, h: number, url = 'data:image/png;base64,xxx'): FakeThumb => ({
  isEmpty: () => false,
  toDataURL: () => url,
  getSize: () => ({ width: w, height: h }),
})
const emptyThumb = (): FakeThumb => ({
  isEmpty: () => true,
  toDataURL: () => '',
  getSize: () => ({ width: 0, height: 0 }),
})

beforeEach(() => {
  desktopState.sources = []
  desktopState.lastOpts = undefined
  screenState.displays = [{ id: 1, size: { width: 1440, height: 900 }, scaleFactor: 2 }]
})

async function load(): Promise<typeof import('@main/vision/screen-capture')> {
  vi.resetModules()
  return await import('@main/vision/screen-capture')
}

describe('captureActiveDisplay', () => {
  it('captures the display matching cursor position and uses scaled thumbnail', async () => {
    desktopState.sources = [{ display_id: '1', thumbnail: goodThumb(2880, 1800) }]
    const { captureActiveDisplay } = await load()
    const out = await captureActiveDisplay()
    expect(out.dataUrl).toBe('data:image/png;base64,xxx')
    expect(out.displayId).toBe('1')
    expect(out.width).toBe(2880)
    expect(out.height).toBe(1800)
    expect(desktopState.lastOpts?.thumbnailSize).toEqual({ width: 2880, height: 1800 })
  })

  it('falls back to first source when no display_id matches', async () => {
    desktopState.sources = [{ display_id: '99', thumbnail: goodThumb(800, 600) }]
    const { captureActiveDisplay } = await load()
    const out = await captureActiveDisplay()
    expect(out.displayId).toBe('99')
  })

  it('throws "No display source available" when desktopCapturer returns nothing', async () => {
    desktopState.sources = []
    const { captureActiveDisplay } = await load()
    await expect(captureActiveDisplay()).rejects.toThrow(/No display source available/)
  })

  it('throws "Captured screen image was empty" on empty thumbnail', async () => {
    desktopState.sources = [{ display_id: '1', thumbnail: emptyThumb() }]
    const { captureActiveDisplay } = await load()
    await expect(captureActiveDisplay()).rejects.toThrow(/empty/i)
  })
})
