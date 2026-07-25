import { systemPreferences, shell } from 'electron'
import type { PermissionStatus } from '@shared/types'

export function getPermissionStatus(): PermissionStatus {
  if (process.platform !== 'darwin') {
    return { mic: 'granted', screen: 'granted' }
  }
  return {
    mic: systemPreferences.getMediaAccessStatus('microphone'),
    screen: systemPreferences.getMediaAccessStatus('screen'),
  }
}

export async function requestMicAccess(): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  return systemPreferences.askForMediaAccess('microphone')
}

export async function openScreenRecordingPrefs(): Promise<void> {
  if (process.platform !== 'darwin') return
  await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
}
