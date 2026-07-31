import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { makeTempUserData } from '../../helpers/temp-userdata'

interface ElectronMockState {
  userDataDir: string
  encryptionAvailable: boolean
}

const electronState: ElectronMockState = { userDataDir: '', encryptionAvailable: true }

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name !== 'userData') throw new Error(`unexpected getPath(${name})`)
      return electronState.userDataDir
    },
    isPackaged: false,
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => electronState.encryptionAvailable),
    encryptString: (s: string) => Buffer.from('enc:' + s, 'utf-8'),
    decryptString: (b: Buffer) => b.toString('utf-8').replace(/^enc:/, ''),
  },
}))

let temp: { path: string; cleanup: () => void }

async function freshSettings(): Promise<typeof import('@main/settings')> {
  vi.resetModules()
  return await import('@main/settings')
}

beforeEach(() => {
  temp = makeTempUserData()
  electronState.userDataDir = temp.path
  electronState.encryptionAvailable = true
  vi.clearAllMocks()
})

afterEach(() => {
  temp.cleanup()
})

describe('settings store', () => {
  it('starts with everything unset and default vision settings', async () => {
    const { settings } = await freshSettings()
    const { safeStorage } = await import('electron')
    await settings.load()
    expect(safeStorage.isEncryptionAvailable).not.toHaveBeenCalled()
    expect(settings.status()).toMatchObject({
      openaiKeySet: false,
      visionProvider: 'openai',
      visionModel: 'gpt-5.1',
      headlineFirst: true,
      vault: {
        hasResume: false,
        hasJobDescription: false,
        hasCompanyValues: false,
        hasInterviewerNotes: false,
        storiesCount: 0,
      },
    })
  })

  it('writes settings.json on first update', async () => {
    const { settings } = await freshSettings()
    await settings.load()
    await settings.update({ openaiKey: 'oa-key' })
    const raw = await fs.readFile(join(temp.path, 'settings.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.version).toBe(6)
    expect(parsed.openaiKeyEnc).toBeDefined()
    expect(raw).not.toContain('oa-key')
  })

  it('round-trips API keys across a process restart with safeStorage available', async () => {
    {
      const { settings } = await freshSettings()
      await settings.load()
      await settings.update({ openaiKey: 'oa-key' })
    }
    {
      const { settings } = await freshSettings()
      await settings.load()
      expect(settings.getOpenAIKey()).toBe('oa-key')
      expect(settings.status()).toMatchObject({
        openaiKeySet: true,
      })
    }
  })

  it('preserves encrypted fields when the keychain is temporarily unavailable', async () => {
    {
      const { settings } = await freshSettings()
      await settings.load()
      await settings.update({ openaiKey: 'oa-key' })
      await settings.setVault({
        resume: 'private resume',
        jobDescription: '',
        companyValues: '',
        interviewerNotes: '',
        stories: [],
      })
    }
    const before = JSON.parse(await fs.readFile(join(temp.path, 'settings.json'), 'utf-8'))

    electronState.encryptionAvailable = false
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    {
      const { settings } = await freshSettings()
      await settings.load()
      await settings.setActivePresetId('coding')
    }
    const after = JSON.parse(await fs.readFile(join(temp.path, 'settings.json'), 'utf-8'))

    expect(after.openaiKeyEnc).toBe(before.openaiKeyEnc)
    expect(after.vaultEnc).toBe(before.vaultEnc)
    warn.mockRestore()
  })

  it('refuses to persist API keys when safeStorage is unavailable', async () => {
    electronState.encryptionAvailable = false
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { settings } = await freshSettings()
    await settings.load()
    await expect(settings.update({ openaiKey: 'plain-key' })).rejects.toThrow(/keychain encryption is unavailable/)
    expect(warn).toHaveBeenCalled()
    await expect(fs.readFile(join(temp.path, 'settings.json'), 'utf-8')).rejects.toMatchObject({ code: 'ENOENT' })
    warn.mockRestore()
  })

  it('refuses to persist vault data when safeStorage is unavailable', async () => {
    electronState.encryptionAvailable = false
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { settings } = await freshSettings()
    await settings.load()
    await expect(settings.setVault({
      resume: 'private',
      jobDescription: '',
      companyValues: '',
      interviewerNotes: '',
      stories: [],
    })).rejects.toThrow(/keychain encryption is unavailable/)
    expect(settings.getVault().resume).toBe('')
    warn.mockRestore()
  })

  it('partial updates do not clobber other fields', async () => {
    const { settings } = await freshSettings()
    await settings.load()
    await settings.update({ openaiKey: 'oa' })
    await settings.update({ visionModel: 'custom-model' })
    expect(settings.getOpenAIKey()).toBe('oa')
    expect(settings.getVisionModel()).toBe('custom-model')
  })

  it('rejects unknown vision providers, accepts "openai"', async () => {
    const { settings } = await freshSettings()
    await settings.load()
    // @ts-expect-error: invalid provider on purpose
    await settings.update({ visionProvider: 'bogus' })
    expect(settings.getVisionProvider()).toBe('openai')
    await settings.update({ visionProvider: 'openai' })
    expect(settings.getVisionProvider()).toBe('openai')
  })

  it('trims vision model and falls back to default when empty', async () => {
    const { settings, DEFAULT_VISION_MODEL } = await freshSettings()
    await settings.load()
    await settings.update({ visionModel: '   ' })
    expect(settings.getVisionModel()).toBe(DEFAULT_VISION_MODEL)
    await settings.update({ visionModel: '  custom-model  ' })
    expect(settings.getVisionModel()).toBe('custom-model')
  })

  it('status() never includes raw key material', async () => {
    const { settings } = await freshSettings()
    await settings.load()
    await settings.update({ openaiKey: 'oa-secret' })
    const status = settings.status()
    const json = JSON.stringify(status)
    expect(json).not.toContain('secret')
    expect(json).not.toContain('oa-secret')
  })

  it('treats corrupt JSON as empty and does not throw', async () => {
    await fs.mkdir(temp.path, { recursive: true })
    await fs.writeFile(join(temp.path, 'settings.json'), '{ this is not json', 'utf-8')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { settings } = await freshSettings()
    await expect(settings.load()).resolves.toBeUndefined()
    expect(settings.status().openaiKeySet).toBe(false)
    warn.mockRestore()
  })

  it('persists active preset id and rejects unknown ids on read', async () => {
    {
      const { settings } = await freshSettings()
      await settings.load()
      await settings.setActivePresetId('coding')
    }
    {
      const { settings } = await freshSettings()
      await settings.load()
      expect(settings.getActivePresetId()).toBe('coding')
    }
  })

  it('returns the default behavioural id when stored active id is invalid', async () => {
    await fs.mkdir(temp.path, { recursive: true })
    await fs.writeFile(
      join(temp.path, 'settings.json'),
      JSON.stringify({ version: 3, activePresetId: 'bogus' }),
      'utf-8',
    )
    const { settings } = await freshSettings()
    await settings.load()
    expect(settings.getActivePresetId()).toBe('behavioral')
  })

  it('persists active answer style id and rejects unknown ids on read', async () => {
    {
      const { settings } = await freshSettings()
      await settings.load()
      await settings.setActiveAnswerStyleId('think-aloud')
    }
    {
      const { settings } = await freshSettings()
      await settings.load()
      expect(settings.getActiveAnswerStyleId()).toBe('think-aloud')
      expect(settings.getAnswerStyleState().active).toBe('think-aloud')
    }

    await fs.writeFile(
      join(temp.path, 'settings.json'),
      JSON.stringify({ version: 4, activeAnswerStyleId: 'bogus' }),
      'utf-8',
    )
    const { settings } = await freshSettings()
    await settings.load()
    expect(settings.getActiveAnswerStyleId()).toBe('concise')
  })

  it('preset overrides set/clear and reflect in getEffectivePrompt and getPresetState', async () => {
    const { settings } = await freshSettings()
    await settings.load()
    await settings.setPresetOverride('coding', 'CUSTOM PROMPT')
    expect(settings.getEffectivePrompt('coding')).toBe('CUSTOM PROMPT')
    expect(settings.getPresetState().presets.find((p) => p.id === 'coding')?.overridden).toBe(true)

    await settings.setPresetOverride('coding', null)
    expect(settings.getPresetState().presets.find((p) => p.id === 'coding')?.overridden).toBe(false)

    await settings.setPresetOverride('coding', '   ')
    expect(settings.getPresetState().presets.find((p) => p.id === 'coding')?.overridden).toBe(false)
  })

  it('headlineFirst defaults to true and persists across reloads', async () => {
    {
      const { settings } = await freshSettings()
      await settings.load()
      expect(settings.getHeadlineFirst()).toBe(true)
      await settings.setHeadlineFirst(false)
    }
    {
      const { settings } = await freshSettings()
      await settings.load()
      expect(settings.getHeadlineFirst()).toBe(false)
      expect(settings.status().headlineFirst).toBe(false)
    }
  })

  it('vault: round-trips full data and reports status', async () => {
    const { settings } = await freshSettings()
    await settings.load()
    await settings.setVault({
      resume: 'r',
      jobDescription: 'j',
      companyValues: 'c',
      interviewerNotes: 'i',
      stories: [
        { id: 's1', title: 'Stripe migration', body: 'b1' },
        { id: 's2', title: 'Mentoring', body: 'b2' },
      ],
    })
    const v = settings.getVault()
    expect(v).toEqual({
      resume: 'r',
      jobDescription: 'j',
      companyValues: 'c',
      interviewerNotes: 'i',
      stories: [
        { id: 's1', title: 'Stripe migration', body: 'b1' },
        { id: 's2', title: 'Mentoring', body: 'b2' },
      ],
    })
    expect(settings.getVaultStatus()).toEqual({
      hasResume: true,
      hasJobDescription: true,
      hasCompanyValues: true,
      hasInterviewerNotes: true,
      storiesCount: 2,
    })
  })

  it('vault: never writes plaintext resume into settings.json', async () => {
    const { settings } = await freshSettings()
    await settings.load()
    await settings.setVault({
      resume: 'SUPER-SECRET-RESUME-TEXT-XYZ',
      jobDescription: '',
      companyValues: '',
      interviewerNotes: '',
      stories: [{ id: 's1', title: 'private', body: 'CONFIDENTIAL-PROJECT' }],
    })
    const raw = await fs.readFile(join(temp.path, 'settings.json'), 'utf-8')
    expect(raw).not.toContain('SUPER-SECRET-RESUME-TEXT-XYZ')
    expect(raw).not.toContain('CONFIDENTIAL-PROJECT')
    expect(raw).toMatch(/"vaultEnc":/)
  })

  it('vault: returns the empty vault when vaultEnc is malformed and does not throw', async () => {
    await fs.mkdir(temp.path, { recursive: true })
    await fs.writeFile(
      join(temp.path, 'settings.json'),
      JSON.stringify({ version: 5, vaultEnc: 'not-a-valid-base64-or-encrypted-blob' }),
      'utf-8',
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { settings } = await freshSettings()
    await settings.load()
    const v = settings.getVault()
    expect(v).toEqual({
      resume: '',
      jobDescription: '',
      companyValues: '',
      interviewerNotes: '',
      stories: [],
    })
    warn.mockRestore()
  })

  it('vault: persists across a process restart with safeStorage available', async () => {
    {
      const { settings } = await freshSettings()
      await settings.load()
      await settings.setVault({
        resume: 'r2',
        jobDescription: 'j2',
        companyValues: '',
        interviewerNotes: '',
        stories: [{ id: 's1', title: 't1', body: 'b1' }],
      })
    }
    {
      const { settings } = await freshSettings()
      await settings.load()
      const v = settings.getVault()
      expect(v.resume).toBe('r2')
      expect(v.stories).toHaveLength(1)
      expect(v.stories[0]).toMatchObject({ title: 't1', body: 'b1' })
    }
  })

  it('migration: a v5 file keeps the OpenAI key and drops retired provider keys on the next write', async () => {
    await fs.mkdir(temp.path, { recursive: true })
    await fs.writeFile(
      join(temp.path, 'settings.json'),
      JSON.stringify({
        version: 5,
        elevenlabsKeyEnc: 'enc:legacy-elevenlabs',
        groqKeyEnc: 'enc:legacy-groq',
        openaiKeyEnc: Buffer.from('enc:openai', 'utf-8').toString('base64'),
      }),
      'utf-8',
    )
    const { settings } = await freshSettings()
    await settings.load()
    expect(settings.getHeadlineFirst()).toBe(true)
    expect(settings.getVault().stories).toHaveLength(0)
    expect(settings.status().vault.storiesCount).toBe(0)
    expect(settings.getOpenAIKey()).toBe('openai')
    await settings.setHeadlineFirst(false)
    const migrated = JSON.parse(await fs.readFile(join(temp.path, 'settings.json'), 'utf-8'))
    expect(migrated.version).toBe(6)
    expect(migrated.elevenlabsKeyEnc).toBeUndefined()
    expect(migrated.groqKeyEnc).toBeUndefined()
  })

  it('settings.update with only headlineFirst persists without clobbering keys', async () => {
    const { settings } = await freshSettings()
    await settings.load()
    await settings.update({ openaiKey: 'oa' })
    await settings.update({ headlineFirst: false })
    expect(settings.getOpenAIKey()).toBe('oa')
    expect(settings.getHeadlineFirst()).toBe(false)
  })
})
