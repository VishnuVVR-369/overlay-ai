import { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import { transcription } from './transcription/transcription-service'
import { openaiAnswer } from './llm/openai-answer-client'
import { openaiVision } from './llm/openai-vision-client'
import { mockInterview } from './mock/mock-interview-service'
import { hideWindow } from './window'

export function triggerPanic(win: BrowserWindow): void {
  try { transcription.stop() } catch { /* idempotent */ }
  try { transcription.clear() } catch { /* idempotent */ }
  try { openaiAnswer.abort() } catch { /* idempotent */ }
  try { openaiVision.abort() } catch { /* idempotent */ }
  try { mockInterview.abort() } catch { /* idempotent */ }
  hideWindow(win)
  if (!win.isDestroyed()) win.webContents.send(IPC.panicTrigger)
}
