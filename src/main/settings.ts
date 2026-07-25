import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type {
  AnswerStyleId,
  AnswerStyleState,
  PresetId,
  PresetState,
  SettingsStatus,
  SettingsUpdate,
  VaultData,
  VaultStatus,
  VaultStory,
  VisionProvider,
} from '@shared/types'
import {
  ANSWER_STYLES,
  DEFAULT_ANSWER_STYLE_ID,
  DEFAULT_PRESET_ID,
  EMPTY_VAULT,
  PRESETS,
  getPresetDef,
  isAnswerStyleId,
  isPresetId,
} from '@shared/prompt'
import { VAULT_LIMITS } from '@shared/vault'

interface SettingsFile {
  version: 5
  elevenlabsKeyEnc?: string
  groqKeyEnc?: string
  openaiKeyEnc?: string
  activePresetId?: PresetId
  activeAnswerStyleId?: AnswerStyleId
  presetOverrides?: Partial<Record<PresetId, string>>
  visionProvider?: VisionProvider
  visionModel?: string
  vaultEnc?: string
  headlineFirst?: boolean
}

const FILE_VERSION = 5
const ACCEPTED_VERSIONS = [1, 2, 3, 4, 5]
const VAULT_FIELD_CAP = VAULT_LIMITS.fieldChars
const VAULT_STORY_TITLE_CAP = VAULT_LIMITS.storyTitleChars
const VAULT_STORY_BODY_CAP = VAULT_LIMITS.storyBodyChars
const VAULT_STORIES_MAX = VAULT_LIMITS.storiesMax
export const DEFAULT_VISION_PROVIDER: VisionProvider = 'openai'
export const DEFAULT_VISION_MODEL = 'gpt-5.1'
export const DEFAULT_HEADLINE_FIRST = true

class SettingsStore {
  private cache: SettingsFile = { version: FILE_VERSION }
  private filePath = ''
  private encryptionAvailable: boolean | null = null
  private vaultCache: VaultData | null = null

  async load(): Promise<void> {
    this.filePath = join(app.getPath('userData'), 'settings.json')
    // Querying safeStorage can synchronously block on the macOS keychain. Keep
    // startup independent of it and probe only when encrypted data is used.
    this.encryptionAvailable = null
    this.vaultCache = null
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as {
        version?: number
        elevenlabsKeyEnc?: string
        groqKeyEnc?: string
        openaiKeyEnc?: string
        activePresetId?: unknown
        activeAnswerStyleId?: unknown
        presetOverrides?: unknown
        visionProvider?: unknown
        visionModel?: unknown
        vaultEnc?: unknown
        headlineFirst?: unknown
      }
      if (parsed && typeof parsed === 'object' && ACCEPTED_VERSIONS.includes(parsed.version ?? 0)) {
        this.cache = {
          version: FILE_VERSION,
          elevenlabsKeyEnc: typeof parsed.elevenlabsKeyEnc === 'string' ? parsed.elevenlabsKeyEnc : undefined,
          groqKeyEnc: typeof parsed.groqKeyEnc === 'string' ? parsed.groqKeyEnc : undefined,
          openaiKeyEnc: typeof parsed.openaiKeyEnc === 'string' ? parsed.openaiKeyEnc : undefined,
          activePresetId: isPresetId(parsed.activePresetId) ? parsed.activePresetId : undefined,
          activeAnswerStyleId: isAnswerStyleId(parsed.activeAnswerStyleId) ? parsed.activeAnswerStyleId : undefined,
          presetOverrides: this.sanitizeOverrides(parsed.presetOverrides),
          visionProvider: this.sanitizeVisionProvider(parsed.visionProvider),
          visionModel: this.sanitizeVisionModel(parsed.visionModel),
          vaultEnc: typeof parsed.vaultEnc === 'string' ? parsed.vaultEnc : undefined,
          headlineFirst: typeof parsed.headlineFirst === 'boolean' ? parsed.headlineFirst : undefined,
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
      headlineFirst: this.getHeadlineFirst(),
      vault: this.getVaultStatus(),
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
    const hasNewSecret = [update.elevenlabsKey, update.groqKey, update.openaiKey]
      .some((value) => typeof value === 'string' && value.length > 0)
    if (hasNewSecret) this.requireEncryption()
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
    if (update.headlineFirst !== undefined) {
      this.cache.headlineFirst = !!update.headlineFirst
    }
    await this.persist()
  }

  getHeadlineFirst(): boolean {
    return this.cache.headlineFirst ?? DEFAULT_HEADLINE_FIRST
  }

  async setHeadlineFirst(value: boolean): Promise<void> {
    this.cache.headlineFirst = !!value
    await this.persist()
  }

  getVault(): VaultData {
    if (this.vaultCache) return this.vaultCache
    if (!this.cache.vaultEnc) {
      this.vaultCache = cloneEmptyVault()
      return this.vaultCache
    }
    if (!this.checkEncryptionAvailable()) return cloneEmptyVault()
    try {
      const buf = Buffer.from(this.cache.vaultEnc, 'base64')
      const json = safeStorage.decryptString(buf)
      const parsed = JSON.parse(json) as unknown
      this.vaultCache = sanitizeVault(parsed)
      return this.vaultCache
    } catch (err) {
      console.warn('[settings] vault decrypt failed', err)
      this.vaultCache = cloneEmptyVault()
      return this.vaultCache
    }
  }

  async setVault(value: VaultData): Promise<void> {
    const sanitized = sanitizeVault(value)
    if (isEmptyVault(sanitized)) {
      this.cache.vaultEnc = undefined
      this.vaultCache = sanitized
      await this.persist()
      return
    }
    this.requireEncryption()
    const json = JSON.stringify(sanitized)
    this.cache.vaultEnc = safeStorage.encryptString(json).toString('base64')
    this.vaultCache = sanitized
    await this.persist()
  }

  getVaultStatus(): VaultStatus {
    const v = this.getVault()
    return {
      hasResume: v.resume.trim().length > 0,
      hasJobDescription: v.jobDescription.trim().length > 0,
      hasCompanyValues: v.companyValues.trim().length > 0,
      hasInterviewerNotes: v.interviewerNotes.trim().length > 0,
      storiesCount: v.stories.length,
    }
  }

  getActivePresetId(): PresetId {
    return this.cache.activePresetId ?? DEFAULT_PRESET_ID
  }

  getActiveAnswerStyleId(): AnswerStyleId {
    return this.cache.activeAnswerStyleId ?? DEFAULT_ANSWER_STYLE_ID
  }

  async setActivePresetId(id: PresetId): Promise<void> {
    this.cache.activePresetId = id
    await this.persist()
  }

  async setActiveAnswerStyleId(id: AnswerStyleId): Promise<void> {
    this.cache.activeAnswerStyleId = id
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

  getAnswerStyleState(): AnswerStyleState {
    return {
      active: this.getActiveAnswerStyleId(),
      styles: ANSWER_STYLES,
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
    this.requireEncryption()
    return safeStorage.encryptString(value).toString('base64')
  }

  private decrypt(stored?: string): string | null {
    if (!stored) return null
    if (!this.checkEncryptionAvailable()) return null
    try {
      const buf = Buffer.from(stored, 'base64')
      return safeStorage.decryptString(buf)
    } catch (err) {
      console.warn('[settings] decrypt failed', err)
      return null
    }
  }

  private requireEncryption(): void {
    if (!this.checkEncryptionAvailable()) {
      throw new Error('OS keychain encryption is unavailable. Secure data was not saved.')
    }
  }

  private checkEncryptionAvailable(): boolean {
    try {
      this.encryptionAvailable = safeStorage.isEncryptionAvailable()
    } catch (err) {
      this.encryptionAvailable = false
      console.warn('[settings] safeStorage availability check failed', err)
    }
    if (!this.encryptionAvailable) {
      console.warn('[settings] safeStorage encryption not available; encrypted settings are unavailable.')
    }
    return this.encryptionAvailable
  }

  private async persist(): Promise<void> {
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(this.cache, null, 2), 'utf-8')
  }
}

export const settings = new SettingsStore()

function cloneEmptyVault(): VaultData {
  return { ...EMPTY_VAULT, stories: [] }
}

function isEmptyVault(vault: VaultData): boolean {
  return (
    !vault.resume &&
    !vault.jobDescription &&
    !vault.companyValues &&
    !vault.interviewerNotes &&
    vault.stories.length === 0
  )
}

export function sanitizeVault(input: unknown): VaultData {
  const v = cloneEmptyVault()
  if (!input || typeof input !== 'object') return v
  const o = input as Record<string, unknown>
  const str = (val: unknown, cap = VAULT_FIELD_CAP): string => {
    if (typeof val !== 'string') return ''
    const trimmed = val.trim()
    return trimmed.length > cap ? trimmed.slice(0, cap) : trimmed
  }
  v.resume = str(o['resume'])
  v.jobDescription = str(o['jobDescription'])
  v.companyValues = str(o['companyValues'])
  v.interviewerNotes = str(o['interviewerNotes'])
  const rawStories = Array.isArray(o['stories']) ? (o['stories'] as unknown[]) : []
  const sanitizedStories: VaultStory[] = []
  for (const item of rawStories) {
    if (sanitizedStories.length >= VAULT_STORIES_MAX) break
    if (!item || typeof item !== 'object') continue
    const s = item as Record<string, unknown>
    const title = str(s['title'], VAULT_STORY_TITLE_CAP)
    const body = str(s['body'], VAULT_STORY_BODY_CAP)
    if (!title || !body) continue
    const id = typeof s['id'] === 'string' && (s['id'] as string).length > 0 ? (s['id'] as string) : `story-${sanitizedStories.length + 1}`
    sanitizedStories.push({ id, title, body })
  }
  v.stories = sanitizedStories
  return v
}
