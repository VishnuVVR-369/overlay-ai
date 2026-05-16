// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsModal } from '@/components/SettingsModal'
import { useUiStore } from '@/state/ui-store'
import { usePresetStore } from '@/state/preset-store'
import { useAnswerStyleStore } from '@/state/answer-style-store'
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
    }
    const { container } = render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    const modelInput = container.querySelector('input[type=text]') as HTMLInputElement
    fireEvent.change(modelInput, { target: { value: 'gpt-5.2' } })
    fireEvent.click(screen.getByText('Save'))
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
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea.value).toBe('BEH-DEFAULT')
    fireEvent.change(textarea, { target: { value: 'CUSTOM' } })
    const saveOverride = screen.getByText('Save override') as HTMLButtonElement
    expect(saveOverride.disabled).toBe(false)
  })

  it('clicking Save override sends a non-null prompt', async () => {
    render(<SettingsModal open={true} onClose={() => {}} />)
    await waitFor(() => expect(api.settings.get).toHaveBeenCalled())
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
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
})
