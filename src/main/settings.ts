import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { SettingsStatus, SettingsUpdate } from '@shared/types'

interface SettingsFile {
  version: 1
  elevenlabsKeyEnc?: string
  groqKeyEnc?: string
}

const FILE_VERSION = 1

class SettingsStore {
  private cache: SettingsFile = { version: FILE_VERSION }
  private filePath = ''
  private encryptionAvailable = false

  async load(): Promise<void> {
    this.filePath = join(app.getPath('userData'), 'settings.json')
    this.encryptionAvailable = safeStorage.isEncryptionAvailable()
    if (!this.encryptionAvailable) {
      console.warn('[settings] safeStorage encryption not available; keys will be stored unencrypted base64.')
    }
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as SettingsFile
      if (parsed && typeof parsed === 'object' && parsed.version === FILE_VERSION) {
        this.cache = parsed
      }
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException
      if (e.code !== 'ENOENT') console.warn('[settings] load failed', e)
    }
  }

  status(): SettingsStatus {
    return {
      elevenlabsKeySet: !!this.cache.elevenlabsKeyEnc,
      groqKeySet: !!this.cache.groqKeyEnc,
    }
  }

  getElevenLabsKey(): string | null {
    return this.decrypt(this.cache.elevenlabsKeyEnc)
  }

  getGroqKey(): string | null {
    return this.decrypt(this.cache.groqKeyEnc)
  }

  async update(update: SettingsUpdate): Promise<void> {
    if (update.elevenlabsKey !== undefined) {
      this.cache.elevenlabsKeyEnc = this.encrypt(update.elevenlabsKey)
    }
    if (update.groqKey !== undefined) {
      this.cache.groqKeyEnc = this.encrypt(update.groqKey)
    }
    await this.persist()
  }

  private encrypt(value: string): string {
    if (!value) return ''
    if (this.encryptionAvailable) {
      return safeStorage.encryptString(value).toString('base64')
    }
    return Buffer.from(value, 'utf-8').toString('base64')
  }

  private decrypt(stored?: string): string | null {
    if (!stored) return null
    try {
      const buf = Buffer.from(stored, 'base64')
      if (this.encryptionAvailable) return safeStorage.decryptString(buf)
      return buf.toString('utf-8')
    } catch (err) {
      console.warn('[settings] decrypt failed', err)
      return null
    }
  }

  private async persist(): Promise<void> {
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(this.cache, null, 2), 'utf-8')
  }
}

export const settings = new SettingsStore()
