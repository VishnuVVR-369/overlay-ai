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
    isEncryptionAvailable: () => electronState.encryptionAvailable,
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
})

afterEach(() => {
  temp.cleanup()
})

describe('settings store', () => {
  it('starts with everything unset and default vision settings', async () => {
    const { settings } = await freshSettings()
    await settings.load()
    expect(settings.status()).toEqual({
      elevenlabsKeySet: false,
      groqKeySet: false,
      openaiKeySet: false,
      visionProvider: 'openai',
      visionModel: 'gpt-5.1',
    })
  })

  it('writes settings.json on first update', async () => {
    const { settings } = await freshSettings()
    await settings.load()
    await settings.update({ elevenlabsKey: 'el-key' })
    const raw = await fs.readFile(join(temp.path, 'settings.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.version).toBe(4)
    expect(parsed.elevenlabsKeyEnc).toBeDefined()
    expect(raw).not.toContain('el-key')
  })

  it('round-trips API keys across a process restart with safeStorage available', async () => {
    {
      const { settings } = await freshSettings()
      await settings.load()
      await settings.update({ elevenlabsKey: 'el-key', groqKey: 'gr-key', openaiKey: 'oa-key' })
    }
    {
      const { settings } = await freshSettings()
      await settings.load()
      expect(settings.getElevenLabsKey()).toBe('el-key')
      expect(settings.getGroqKey()).toBe('gr-key')
      expect(settings.getOpenAIKey()).toBe('oa-key')
      expect(settings.status()).toMatchObject({
        elevenlabsKeySet: true,
        groqKeySet: true,
        openaiKeySet: true,
      })
    }
  })

  it('falls back to base64 when safeStorage is unavailable, and warns', async () => {
    electronState.encryptionAvailable = false
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { settings } = await freshSettings()
    await settings.load()
    await settings.update({ groqKey: 'plain-key' })
    expect(warn).toHaveBeenCalled()
    const raw = await fs.readFile(join(temp.path, 'settings.json'), 'utf-8')
    expect(raw).toContain(Buffer.from('plain-key', 'utf-8').toString('base64'))
    warn.mockRestore()
  })

  it('partial updates do not clobber other fields', async () => {
    const { settings } = await freshSettings()
    await settings.load()
    await settings.update({ elevenlabsKey: 'el', groqKey: 'gr', openaiKey: 'oa' })
    await settings.update({ groqKey: 'gr2' })
    expect(settings.getElevenLabsKey()).toBe('el')
    expect(settings.getGroqKey()).toBe('gr2')
    expect(settings.getOpenAIKey()).toBe('oa')
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
    await settings.update({ elevenlabsKey: 'el-secret', groqKey: 'gr-secret', openaiKey: 'oa-secret' })
    const status = settings.status()
    const json = JSON.stringify(status)
    expect(json).not.toContain('secret')
    expect(json).not.toContain('el-key')
  })

  it('treats corrupt JSON as empty and does not throw', async () => {
    await fs.mkdir(temp.path, { recursive: true })
    await fs.writeFile(join(temp.path, 'settings.json'), '{ this is not json', 'utf-8')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { settings } = await freshSettings()
    await expect(settings.load()).resolves.toBeUndefined()
    expect(settings.status().elevenlabsKeySet).toBe(false)
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
})
