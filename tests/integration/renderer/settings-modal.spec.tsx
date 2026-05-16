// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsModal } from '@/components/SettingsModal'
import { useUiStore } from '@/state/ui-store'
import { usePresetStore } from '@/state/preset-store'
import { useAnswerStyleStore } from '@/state/answer-style-store'
import { useVaultStore, emptyVault } from '@/state/vault-store'
import { installFakeApi, createFakeApi, type FakeApi } from '../../helpers/fake-window-api'

let api: FakeApi

beforeEach(() => {
  useUiStore.setState({
    mode: 'normal',
    helpOpen: false,
    settingsOpen: true,
    focused: true,
    permStatus: { mic: 'granted', screen: 'granted' },
    expandedEntries: {},
  })
  usePresetStore.setState({
    active: 'behavioral',
    presets: [
      { id: 'behavioral', label: 'Behavioral', defaultPrompt: 'BEH-DEFAULT', effectivePrompt: 'BEH-DEFAULT', overridden: false },
      { id: 'coding', label: 'Coding', defaultPrompt: 'COD-DEFAULT', effectivePrompt: 'COD-DEFAULT', overridden: false },
    ],
    hydrated: true,
  })
  useAnswerStyleStore.setState({
    active: 'concise',
    styles: [
      { id: 'concise', label: 'Concise', instruction: 'short' },
      { id: 'think-aloud', label: 'Think aloud', instruction: 'steps' },
    ],
    hydrated: true,
  })
  useVaultStore.setState({ data: emptyVault(), hydrated: false })
  useUiStore.setState({ headlineFirst: true })
  api = installFakeApi(createFakeApi())
})

describe('SettingsModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<SettingsModal open={false} onClose={() => {}} />)
    expect(container.querySelector('.slide-over')).toBeNull()
  })

  it('renders three masked API key inputs and a vision model field', async () => {
    const { container } = render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    const passwordInputs = container.querySelectorAll('input[type=password]')
    expect(passwordInputs.length).toBe(3)
    expect((container.querySelector('input[placeholder*="gpt-5.1"]') as HTMLInputElement)?.type).toBe('text')
  })

  it('renders readiness checks and can rerun the local readiness check', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.readiness.check).toHaveBeenCalled())
    expect(screen.getByText('Readiness')).toBeTruthy()
    expect(screen.getByText('Groq key')).toBeTruthy()
    fireEvent.click(screen.getByText('Run Check'))
    await waitFor(() => expect(api.readiness.check).toHaveBeenCalledTimes(2))
  })

  it('Save sends only the keys that have non-empty values', async () => {
    const { container } = render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    const inputs = container.querySelectorAll('input[type=password]') as NodeListOf<HTMLInputElement>
    fireEvent.change(inputs[0], { target: { value: '  el-key  ' } })
    fireEvent.change(inputs[1], { target: { value: 'gr-key' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(api.__state.settingsUpdates.length).toBeGreaterThan(0))
    const last = api.__state.settingsUpdates[api.__state.settingsUpdates.length - 1]
    expect(last).toEqual({ elevenlabsKey: 'el-key', groqKey: 'gr-key' })
  })

  it('Save with no changes is disabled', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    const saveButton = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)
  })

  it('Save sends a vision-model-only update when only the model changes', async () => {
    api.__state.settings = {
      elevenlabsKeySet: true,
      groqKeySet: true,
      openaiKeySet: true,
      visionProvider: 'openai',
      visionModel: 'gpt-5.1',
      headlineFirst: true,
      vault: { hasResume: false, hasJobDescription: false, hasCompanyValues: false, hasInterviewerNotes: false, storiesCount: 0 },
    }
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    const modelInput = screen.getByPlaceholderText('gpt-5.1') as HTMLInputElement
    fireEvent.change(modelInput, { target: { value: 'gpt-5.2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.settings.set).toHaveBeenCalledWith({ visionModel: 'gpt-5.2' }))
  })

  it('selecting a different preset tab calls setActive', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Coding'))
    await waitFor(() => expect(api.presets.setActive).toHaveBeenCalledWith('coding'))
  })

  it('selecting a different answer style calls setActive', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('Answer style'), {
      target: { value: 'think-aloud' },
    })
    await waitFor(() => expect(api.answerStyles.setActive).toHaveBeenCalledWith('think-aloud'))
  })

  it('typing into the system prompt textarea enables Save override', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    const textarea = screen.getByLabelText('System prompt for Behavioral') as HTMLTextAreaElement
    expect(textarea.value).toBe('BEH-DEFAULT')
    fireEvent.change(textarea, { target: { value: 'CUSTOM' } })
    const saveOverride = screen.getByText('Save override') as HTMLButtonElement
    expect(saveOverride.disabled).toBe(false)
  })

  it('clicking Save override sends a non-null prompt', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    const textarea = screen.getByLabelText('System prompt for Behavioral') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'CUSTOM' } })
    fireEvent.click(screen.getByText('Save override'))
    await waitFor(() => expect(api.presets.setOverride).toHaveBeenCalled())
    expect(api.__state.presetOverrides[0]).toEqual({ id: 'behavioral', prompt: 'CUSTOM' })
  })

  it('Reset to default is disabled when not overridden', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    const reset = screen.getByText('Reset to default') as HTMLButtonElement
    expect(reset.disabled).toBe(true)
  })

  it('Reset to default clears an existing preset override', async () => {
    usePresetStore.setState({
      active: 'coding',
      presets: [
        { id: 'coding', label: 'Coding', defaultPrompt: 'COD-DEFAULT', effectivePrompt: 'CUSTOM', overridden: true },
      ],
      hydrated: true,
    })
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Reset to default'))
    await waitFor(() => expect(api.presets.setOverride).toHaveBeenCalledWith({ id: 'coding', prompt: null }))
  })

  it('renders mic/screen permission rows and "Recheck" button', async () => {
    api.__state.perms = { mic: 'denied', screen: 'denied' }
    useUiStore.setState({ permStatus: { mic: 'denied', screen: 'denied' } })
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Request')).toBeTruthy())
    expect(screen.getByText('Microphone')).toBeTruthy()
    expect(screen.getByText('Screen Recording')).toBeTruthy()
    expect(screen.getByText('Open System Settings')).toBeTruthy()
    expect(screen.getByText('Recheck')).toBeTruthy()
  })

  it('permission actions request mic, open screen settings, and recheck status', async () => {
    api.__state.perms = { mic: 'denied', screen: 'denied' }
    useUiStore.setState({ permStatus: { mic: 'denied', screen: 'denied' } })
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Request'))
    await waitFor(() => expect(api.permissions.requestMic).toHaveBeenCalled())
    await waitFor(() => expect(api.permissions.status).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByText('Open System Settings'))
    expect(api.permissions.openScreenPrefs).toHaveBeenCalled()

    fireEvent.click(screen.getByText('Recheck'))
    await waitFor(() => expect(api.permissions.status).toHaveBeenCalledTimes(3))
  })

  it('clicking Close calls onClose, clicking the catcher backdrop also calls onClose', async () => {
    const onClose = vi.fn()
    const { container } = render(<SettingsModal open={true} onClose={onClose} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    fireEvent.click(container.querySelector('.slide-over-catcher')!)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('renders the Personal Context section with four labelled fields', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.vault.get).toHaveBeenCalled())
    expect(screen.getByText('Personal Context')).toBeTruthy()
    expect(screen.getByLabelText('Resume / background')).toBeTruthy()
    expect(screen.getByLabelText('Role / job description')).toBeTruthy()
    expect(screen.getByLabelText('Company values')).toBeTruthy()
    expect(screen.getByLabelText('Interviewer notes')).toBeTruthy()
  })

  it('Save personal context is disabled until the draft differs from the hydrated vault', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.vault.get).toHaveBeenCalled())
    const save = screen.getByRole('button', { name: 'Save personal context' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Resume / background'), { target: { value: 'My resume bullets' } })
    expect((screen.getByRole('button', { name: 'Save personal context' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('Saving personal context calls window.api.vault.set with the full draft', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.vault.get).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('Resume / background'), { target: { value: 'r' } })
    fireEvent.change(screen.getByLabelText('Role / job description'), { target: { value: 'j' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save personal context' }))
    await waitFor(() => expect(api.vault.set).toHaveBeenCalled())
    const last = api.__state.vaultUpdates[api.__state.vaultUpdates.length - 1]
    expect(last.resume).toBe('r')
    expect(last.jobDescription).toBe('j')
  })

  it('+ Add story appends a card and Remove deletes it', async () => {
    const { container } = render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.vault.get).toHaveBeenCalled())
    expect(container.querySelectorAll('.vault-story').length).toBe(0)
    fireEvent.click(screen.getByText('+ Add story'))
    expect(container.querySelectorAll('.vault-story').length).toBe(1)
    fireEvent.change(screen.getByLabelText('Story 1 title'), { target: { value: 'Stripe migration' } })
    fireEvent.change(screen.getByLabelText('Story 1 body'), { target: { value: 'Cut latency 40%' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save personal context' }))
    await waitFor(() => expect(api.vault.set).toHaveBeenCalled())
    const last = api.__state.vaultUpdates[api.__state.vaultUpdates.length - 1]
    expect(last.stories[0]).toMatchObject({ title: 'Stripe migration', body: 'Cut latency 40%' })

    fireEvent.click(screen.getByLabelText('Remove story 1'))
    expect(container.querySelectorAll('.vault-story').length).toBe(0)
  })

  it('headline-first checkbox starts from the hydrated status and toggles via settings.set', async () => {
    api.__state.settings.headlineFirst = false
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    const checkbox = screen.getByLabelText('Headline-first answers') as HTMLInputElement
    await waitFor(() => expect(checkbox.checked).toBe(false))
    fireEvent.click(checkbox)
    await waitFor(() => expect(api.settings.set).toHaveBeenCalledWith({ headlineFirst: true }))
    expect(useUiStore.getState().headlineFirst).toBe(true)
  })

  it('Save personal context becomes disabled again once the vault store reflects the new value', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.vault.get).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('Resume / background'), { target: { value: 'r' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save personal context' }))
    await waitFor(() => expect(api.vault.set).toHaveBeenCalled())
    // App is the one that subscribes to vault.onChanged + writes to the store.
    // Simulate that downstream effect here.
    useVaultStore.setState({ data: { ...emptyVault(), resume: 'r' }, hydrated: true })
    await waitFor(() => {
      const save = screen.getByRole('button', { name: 'Save personal context' }) as HTMLButtonElement
      expect(save.disabled).toBe(true)
    })
  })
})
