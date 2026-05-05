import { desktopCapturer, screen } from 'electron'

export interface ScreenCapture {
  dataUrl: string
  width: number
  height: number
  displayId: string
}

export async function captureActiveDisplay(): Promise<ScreenCapture> {
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint) ?? screen.getPrimaryDisplay()
  const pixelWidth = Math.max(1, Math.round(display.size.width * display.scaleFactor))
  const pixelHeight = Math.max(1, Math.round(display.size.height * display.scaleFactor))

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: pixelWidth, height: pixelHeight },
  })

  const displayId = String(display.id)
  const source = sources.find((s) => s.display_id === displayId) ?? sources[0]
  if (!source) throw new Error('No display source available for screen capture.')
  if (source.thumbnail.isEmpty()) throw new Error('Captured screen image was empty.')

  const size = source.thumbnail.getSize()
  return {
    dataUrl: source.thumbnail.toDataURL(),
    width: size.width,
    height: size.height,
    displayId: source.display_id,
  }
}
