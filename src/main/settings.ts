import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type {
  PresetId,
  PresetState,
  SettingsStatus,
  SettingsUpdate,
  VisionProvider,
} from '@shared/types'
import { DEFAULT_PRESET_ID, PRESETS, getPresetDef, isPresetId } from '@shared/prompt'

interface SettingsFile {
  version: 3
  elevenlabsKeyEnc?: string
  groqKeyEnc?: string
  openaiKeyEnc?: string
  activePresetId?: PresetId
  presetOverrides?: Partial<Record<PresetId, string>>
  visionProvider?: VisionProvider
  visionModel?: string
}

const FILE_VERSION = 3
export const DEFAULT_VISION_PROVIDER: VisionProvider = 'openai'
export const DEFAULT_VISION_MODEL = 'gpt-5.1'

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
      const parsed = JSON.parse(raw) as {
        version?: number
        elevenlabsKeyEnc?: string
        groqKeyEnc?: string
        openaiKeyEnc?: string
        activePresetId?: unknown
        presetOverrides?: unknown
        visionProvider?: unknown
        visionModel?: unknown
      }
      if (parsed && typeof parsed === 'object' && [1, 2, 3].includes(parsed.version ?? 0)) {
        this.cache = {
          version: FILE_VERSION,
          elevenlabsKeyEnc: parsed.elevenlabsKeyEnc,
          groqKeyEnc: parsed.groqKeyEnc,
          openaiKeyEnc: parsed.openaiKeyEnc,
          activePresetId: isPresetId(parsed.activePresetId) ? parsed.activePresetId : undefined,
          presetOverrides: this.sanitizeOverrides(parsed.presetOverrides),
          visionProvider: this.sanitizeVisionProvider(parsed.visionProvider),
          visionModel: this.sanitizeVisionModel(parsed.visionModel),
        }
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
      openaiKeySet: !!this.cache.openaiKeyEnc,
      visionProvider: this.getVisionProvider(),
      visionModel: this.getVisionModel(),
    }
  }

  getElevenLabsKey(): string | null {
    return this.decrypt(this.cache.elevenlabsKeyEnc)
  }

  getGroqKey(): string | null {
    return this.decrypt(this.cache.groqKeyEnc)
  }

  getOpenAIKey(): string | null {
    return this.decrypt(this.cache.openaiKeyEnc)
  }

  getVisionProvider(): VisionProvider {
    return this.cache.visionProvider ?? DEFAULT_VISION_PROVIDER
  }

  getVisionModel(): string {
    return this.cache.visionModel ?? DEFAULT_VISION_MODEL
  }

  async update(update: SettingsUpdate): Promise<void> {
    if (update.elevenlabsKey !== undefined) {
      this.cache.elevenlabsKeyEnc = this.encrypt(update.elevenlabsKey)
    }
    if (update.groqKey !== undefined) {
      this.cache.groqKeyEnc = this.encrypt(update.groqKey)
    }
    if (update.openaiKey !== undefined) {
      this.cache.openaiKeyEnc = this.encrypt(update.openaiKey)
    }
    if (update.visionProvider !== undefined) {
      this.cache.visionProvider = this.sanitizeVisionProvider(update.visionProvider)
    }
    if (update.visionModel !== undefined) {
      this.cache.visionModel = this.sanitizeVisionModel(update.visionModel)
    }
    await this.persist()
  }

  getActivePresetId(): PresetId {
    return this.cache.activePresetId ?? DEFAULT_PRESET_ID
  }

  async setActivePresetId(id: PresetId): Promise<void> {
    this.cache.activePresetId = id
    await this.persist()
  }

  getEffectivePrompt(id: PresetId): string {
    const override = this.cache.presetOverrides?.[id]
    if (typeof override === 'string' && override.trim().length > 0) return override
    return getPresetDef(id).defaultPrompt
  }

  async setPresetOverride(id: PresetId, prompt: string | null): Promise<void> {
    if (!this.cache.presetOverrides) this.cache.presetOverrides = {}
    if (prompt === null || prompt.trim().length === 0) {
      delete this.cache.presetOverrides[id]
    } else {
      this.cache.presetOverrides[id] = prompt
    }
    await this.persist()
  }

  getPresetState(): PresetState {
    return {
      active: this.getActivePresetId(),
      presets: PRESETS.map((p) => {
        const override = this.cache.presetOverrides?.[p.id]
        const overridden = typeof override === 'string' && override.trim().length > 0
        return {
          id: p.id,
          label: p.label,
          defaultPrompt: p.defaultPrompt,
          effectivePrompt: overridden ? (override as string) : p.defaultPrompt,
          overridden,
        }
      }),
    }
  }

  private sanitizeOverrides(input: unknown): Partial<Record<PresetId, string>> | undefined {
    if (!input || typeof input !== 'object') return undefined
    const out: Partial<Record<PresetId, string>> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (isPresetId(k) && typeof v === 'string' && v.trim().length > 0) {
        out[k] = v
      }
    }
    return Object.keys(out).length > 0 ? out : undefined
  }

  private sanitizeVisionProvider(input: unknown): VisionProvider | undefined {
    return input === 'openai' ? 'openai' : undefined
  }

  private sanitizeVisionModel(input: unknown): string | undefined {
    if (typeof input !== 'string') return undefined
    const trimmed = input.trim()
    return trimmed.length > 0 ? trimmed : undefined
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
