// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, fireEvent, waitFor, act, screen } from '@testing-library/react'
import { Console } from '@/components/Console'
import { useUiStore, type ConsoleTab } from '@/state/ui-store'
import { useMockStore } from '@/state/mock-store'
import { usePresetStore } from '@/state/preset-store'
import { useAnswerStyleStore } from '@/state/answer-style-store'
import { useVaultStore, emptyVault } from '@/state/vault-store'
import { useMockSessionsStore } from '@/state/mock-sessions-store'
import { installFakeApi, createFakeApi, type FakeApi } from '../../helpers/fake-window-api'

let api: FakeApi

function renderConsole(tab: ConsoleTab, over: Partial<Parameters<typeof Console>[0]> = {}) {
  const props = {
    tab,
    starting: false,
    onSelect: vi.fn(),
    onClose: vi.fn(),
    onStartMock: vi.fn(),
    onStopMock: vi.fn(),
    ...over,
  }
  return { props, ...render(<Console {...props} />) }
}

beforeEach(() => {
  useUiStore.setState({
    mode: 'normal',
    consoleTab: null,
    paletteOpen: false,
    focused: true,
    permStatus: { mic: 'granted', screen: 'granted' },
    expandedEntries: {},
    headlineFirst: true,
  })
  useMockStore.setState({ status: { state: 'idle', paused: false } })
  useVaultStore.setState({ data: emptyVault(), draft: null, hydrated: false })
  useMockSessionsStore.setState({
    summaries: [],
    loaded: false,
    selectedId: null,
    selectedRecord: null,
    loadingRecord: false,
  })
  usePresetStore.setState({
    active: 'behavioral',
    presets: [
      { id: 'behavioral', label: 'Behavioral', defaultPrompt: 'base', effectivePrompt: 'base', overridden: false },
      { id: 'coding', label: 'Coding', defaultPrompt: 'base', effectivePrompt: 'custom', overridden: true },
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

describe('Console shell', () => {
  it('renders nothing when no tab is selected', () => {
    const { container } = renderConsole(null as unknown as ConsoleTab)
    expect(container.querySelector('.console')).toBeNull()
  })

  it('marks the current tab and reports selections', () => {
    const { props, getByRole } = renderConsole('setup')
    expect(getByRole('button', { name: 'Setup' }).getAttribute('aria-current')).toBe('page')
    fireEvent.click(getByRole('button', { name: 'History' }))
    expect(props.onSelect).toHaveBeenCalledWith('history')
  })

  it('closes from the close button and from the scrim behind it', () => {
    const { props, container, getByLabelText } = renderConsole('setup')
    fireEvent.click(getByLabelText('Close console'))
    fireEvent.click(container.querySelector('.console-scrim')!)
    expect(props.onClose).toHaveBeenCalledTimes(2)
  })
})

describe('Setup tab', () => {
  it('summarises readiness rather than making the user read every row', async () => {
    api.__state.readiness = {
      checkedAt: 1,
      checks: [
        { id: 'a', label: 'Groq key', level: 'fail', detail: 'Missing.' },
        { id: 'b', label: 'Mic', level: 'pass', detail: 'Granted.' },
      ],
    }
    renderConsole('setup')
    await waitFor(() => expect(screen.getByText('1 thing is blocking a live interview.')).toBeTruthy())
    expect(screen.getByText('Groq key')).toBeTruthy()
  })

  it('says so plainly when nothing is blocking', async () => {
    api.__state.readiness = {
      checkedAt: 1,
      checks: [{ id: 'b', label: 'Mic', level: 'pass', detail: 'Granted.' }],
    }
    renderConsole('setup')
    await waitFor(() =>
      expect(screen.getByText('Everything needed for a live interview is in place.')).toBeTruthy(),
    )
  })

  it('keeps Save disabled until something actually changed', async () => {
    renderConsole('setup')
    const save = await waitFor(() => screen.getByText('Save keys') as HTMLButtonElement)
    expect(save.disabled).toBe(true)

    fireEvent.change(screen.getByPlaceholderText('gsk_…'), { target: { value: 'gsk_live' } })
    await waitFor(() => expect((screen.getByText('Save keys') as HTMLButtonElement).disabled).toBe(false))
  })

  it('sends only the fields that were filled in, then clears them', async () => {
    renderConsole('setup')
    await waitFor(() => screen.getByText('Save keys'))
    fireEvent.change(screen.getByPlaceholderText('gsk_…'), { target: { value: 'gsk_live' } })
    fireEvent.click(screen.getByText('Save keys'))

    await waitFor(() => expect(api.settings.set).toHaveBeenCalledWith({ groqKey: 'gsk_live' }))
    await waitFor(() =>
      expect((screen.getByPlaceholderText(/paste to replace/) as HTMLInputElement).value).toBe(''),
    )
  })

  it('re-runs the readiness check after saving, so the summary cannot go stale', async () => {
    renderConsole('setup')
    await waitFor(() => expect(api.readiness.check).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByPlaceholderText('gsk_…'), { target: { value: 'gsk_live' } })
    fireEvent.click(screen.getByText('Save keys'))
    await waitFor(() => expect(api.readiness.check).toHaveBeenCalledTimes(2))
  })

  it('offers to request permissions only while they are missing', async () => {
    act(() => useUiStore.setState({ permStatus: { mic: 'denied', screen: 'granted' } }))
    api.__state.perms = { mic: 'denied', screen: 'granted' }
    renderConsole('setup')
    await waitFor(() => expect(screen.getByText('Request')).toBeTruthy())
    expect(screen.queryByText('Open settings')).toBeNull()
    fireEvent.click(screen.getByText('Request'))
    await waitFor(() => expect(api.permissions.requestMic).toHaveBeenCalled())
  })
})

describe('Prompts tab', () => {
  it('shows every mode and flags the overridden ones', async () => {
    renderConsole('prompts')
    expect(screen.getByText('Behavioral')).toBeTruthy()
    expect(screen.getByText('Coding')).toBeTruthy()
    expect(screen.getByText('custom')).toBeTruthy()
  })

  it('marks the active mode as pressed and switches on click', async () => {
    renderConsole('prompts')
    expect(screen.getByRole('button', { name: /Behavioral/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /Coding/ }))
    await waitFor(() => expect(api.presets.setActive).toHaveBeenCalledWith('coding'))
  })

  it('loads the selected preset prompt and enables Save only once edited', async () => {
    renderConsole('prompts')
    const editor = await waitFor(() => screen.getByLabelText('System prompt for Behavioral') as HTMLTextAreaElement)
    expect(editor.value).toBe('base')
    // Untouched, the draft still equals the built-in default, so saving is a no-op.
    expect((screen.getByText('Save (clears override)') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(editor, { target: { value: 'my own prompt' } })
    await waitFor(() => expect((screen.getByText('Save override') as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByText('Save override'))
    await waitFor(() =>
      expect(api.presets.setOverride).toHaveBeenCalledWith({ id: 'behavioral', prompt: 'my own prompt' }),
    )
  })

  it('clears the override when the text is edited back to the default', async () => {
    act(() =>
      usePresetStore.setState({
        active: 'behavioral',
        presets: [
          { id: 'behavioral', label: 'Behavioral', defaultPrompt: 'base', effectivePrompt: 'mine', overridden: true },
        ],
        hydrated: true,
      }),
    )
    renderConsole('prompts')
    const editor = await waitFor(() => screen.getByLabelText('System prompt for Behavioral') as HTMLTextAreaElement)
    fireEvent.change(editor, { target: { value: 'base' } })
    fireEvent.click(screen.getByText('Save (clears override)'))
    await waitFor(() =>
      expect(api.presets.setOverride).toHaveBeenCalledWith({ id: 'behavioral', prompt: null }),
    )
  })

  it('persists the headline-first toggle', async () => {
    renderConsole('prompts')
    fireEvent.click(screen.getByLabelText('Headline-first answers'))
    await waitFor(() => expect(api.settings.set).toHaveBeenCalledWith({ headlineFirst: false }))
    expect(useUiStore.getState().headlineFirst).toBe(false)
  })

  it('changes the answer style', async () => {
    renderConsole('prompts')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'think-aloud' } })
    await waitFor(() => expect(api.answerStyles.setActive).toHaveBeenCalledWith('think-aloud'))
  })
})

describe('Context tab', () => {
  it('reports how much context is filled in', async () => {
    api.__state.vault = {
      resume: 'my resume',
      jobDescription: '',
      companyValues: '',
      interviewerNotes: '',
      stories: [{ id: 's1', title: 'Migration', body: 'did a thing' }],
    }
    renderConsole('context')
    await waitFor(() => expect(screen.getByText('1 of 4 sections filled · 1 story')).toBeTruthy())
  })

  it('keeps Save disabled until the draft diverges from what is stored', async () => {
    renderConsole('context')
    await waitFor(() => expect((screen.getByText('Saved') as HTMLButtonElement).disabled).toBe(true))

    fireEvent.change(screen.getByPlaceholderText(/Paste a short resume summary/), {
      target: { value: 'new resume' },
    })
    await waitFor(() =>
      expect((screen.getByText('Save personal context') as HTMLButtonElement).disabled).toBe(false),
    )
  })

  it('adds, edits, and removes STAR stories', async () => {
    renderConsole('context')
    await waitFor(() => expect(screen.getByText(/No stories yet/)).toBeTruthy())

    fireEvent.click(screen.getByText('Add'))
    fireEvent.change(screen.getByLabelText('Story 1 title'), { target: { value: 'Payments migration' } })
    fireEvent.change(screen.getByLabelText('Story 1 body'), { target: { value: 'S/T/A/R' } })
    fireEvent.click(screen.getByText('Save personal context'))

    await waitFor(() => expect(api.vault.set).toHaveBeenCalled())
    const saved = api.__state.vaultUpdates.at(-1)!
    expect(saved.stories).toHaveLength(1)
    expect(saved.stories[0].title).toBe('Payments migration')

    fireEvent.click(screen.getByLabelText('Remove story 1'))
    await waitFor(() => expect(screen.getByText(/No stories yet/)).toBeTruthy())
  })

  it('waits for the stored vault before showing an editable form', async () => {
    renderConsole('context')
    expect(screen.getByText('Loading your saved context…')).toBeTruthy()
    expect(screen.queryByPlaceholderText(/Paste a short resume summary/)).toBeNull()

    await waitFor(() => expect(screen.getByText(/No stories yet/)).toBeTruthy())
    expect(useVaultStore.getState().draft).not.toBeNull()
  })

  it('adopts the vault the main process actually stored after a save', async () => {
    renderConsole('context')
    await waitFor(() => expect(screen.getByText(/No stories yet/)).toBeTruthy())

    fireEvent.change(screen.getByPlaceholderText(/Paste a short resume summary/), {
      target: { value: '  padded resume  ' },
    })
    fireEvent.click(screen.getByText('Add'))
    fireEvent.click(screen.getByText('Save personal context'))

    await waitFor(() => expect((screen.getByText('Saved') as HTMLButtonElement).disabled).toBe(true))
    expect(
      (screen.getByPlaceholderText(/Paste a short resume summary/) as HTMLTextAreaElement).value,
    ).toBe('padded resume')
    expect(screen.getByText(/No stories yet/)).toBeTruthy()
    expect(useVaultStore.getState().data.resume).toBe('padded resume')
  })

  it('preserves an unsaved draft while navigating between console tabs', async () => {
    const props = {
      tab: 'context' as ConsoleTab,
      starting: false,
      onSelect: vi.fn(),
      onClose: vi.fn(),
      onStartMock: vi.fn(),
      onStopMock: vi.fn(),
    }
    const view = render(<Console {...props} />)
    await waitFor(() => expect(screen.getByText(/No stories yet/)).toBeTruthy())
    fireEvent.click(screen.getByText('Add'))
    expect(screen.getByText('0 of 4 sections filled · 1 story')).toBeTruthy()

    view.rerender(<Console {...props} tab="prompts" />)
    view.rerender(<Console {...props} tab="context" />)

    expect(screen.getByLabelText('Story 1 title')).toBeTruthy()
    expect(screen.getByText('0 of 4 sections filled · 1 story')).toBeTruthy()
    expect(screen.getByText('Save personal context')).toBeTruthy()
  })
})

describe('Practice tab', () => {
  it('starts a mock with the chosen type and duration', async () => {
    const { props } = renderConsole('practice')
    fireEvent.click(screen.getByRole('button', { name: /Coding/ }))
    fireEvent.click(screen.getByRole('button', { name: '45m' }))
    fireEvent.click(screen.getByText('Start 45-minute mock'))
    expect(props.onStartMock).toHaveBeenCalledWith({ presetId: 'coding', durationMinutes: 45 })
  })

  it('surfaces a failed session instead of silently returning to the form', () => {
    act(() =>
      useMockStore.setState({ status: { state: 'error', paused: false, message: 'realtime handshake failed' } }),
    )
    renderConsole('practice')
    expect(screen.getByText('realtime handshake failed')).toBeTruthy()
  })

  it('replaces the form with live controls once a session is running', () => {
    act(() => useMockStore.setState({ status: { state: 'active', paused: false } }))
    renderConsole('practice')
    expect(screen.getByText('Mock interview in progress')).toBeTruthy()
    expect(screen.getByText('Live')).toBeTruthy()
    expect(screen.queryByText(/Start .*-minute mock/)).toBeNull()
  })

  it('counts down the time remaining', () => {
    const now = Date.now()
    act(() =>
      useMockStore.setState({
        status: { state: 'active', paused: false, startedAt: now, endsAt: now + 125_000 },
      }),
    )
    renderConsole('practice')
    expect(screen.getByLabelText('Time remaining').textContent).toContain('2:0')
  })

  it('pauses and resumes the interviewer through main', async () => {
    act(() => useMockStore.setState({ status: { state: 'active', paused: false } }))
    const { unmount } = renderConsole('practice')
    fireEvent.click(screen.getByText('Pause'))
    await waitFor(() => expect(api.mock.pause).toHaveBeenCalled())
    unmount()

    act(() => useMockStore.setState({ status: { state: 'paused', paused: true } }))
    renderConsole('practice')
    expect(screen.getByText('Paused')).toBeTruthy()
    fireEvent.click(screen.getByText('Resume'))
    await waitFor(() => expect(api.mock.resume).toHaveBeenCalled())
  })

  it('ends the session through the parent so capture and playback stop too', () => {
    act(() => useMockStore.setState({ status: { state: 'active', paused: false } }))
    const { props } = renderConsole('practice')
    fireEvent.click(screen.getByText('End & grade'))
    expect(props.onStopMock).toHaveBeenCalled()
  })

  it('disables pause while the realtime session is still connecting', () => {
    act(() => useMockStore.setState({ status: { state: 'connecting', paused: false } }))
    renderConsole('practice')
    expect(screen.getByText('Connecting')).toBeTruthy()
    expect((screen.getByText('Pause').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('Help tab', () => {
  it('is generated from the command registry, keys included', () => {
    renderConsole('help')
    expect(screen.getByText('Ask from transcript')).toBeTruthy()
    expect(screen.getByText('Start listening')).toBeTruthy()
    expect(screen.getByText('Panic — wipe and hide')).toBeTruthy()
  })

  it('flags which shortcuts survive the overlay being unfocused', () => {
    const { container } = renderConsole('help')
    expect(container.querySelectorAll('.pill-ok').length).toBeGreaterThan(0)
  })

  it('labels palette-only actions instead of showing an empty key slot', () => {
    const { container } = renderConsole('help')
    expect(container.querySelector('.keys-none')?.textContent).toBe('palette')
  })
})
