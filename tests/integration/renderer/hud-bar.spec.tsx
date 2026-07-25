// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { HudBar } from '@/components/HudBar'
import { useUiStore } from '@/state/ui-store'
import { useStatusStore } from '@/state/status-store'
import { useMockStore } from '@/state/mock-store'
import { useLlmStore } from '@/state/llm-store'
import { useTranscriptStore } from '@/state/transcript-store'
import { usePresetStore } from '@/state/preset-store'

function renderBar(over: Partial<Parameters<typeof HudBar>[0]> = {}) {
  const props = {
    onToggleListening: vi.fn(),
    onOpenPalette: vi.fn(),
    onOpenPrompts: vi.fn(),
    onOpenSetup: vi.fn(),
    ...over,
  }
  return { props, ...render(<HudBar {...props} />) }
}

beforeEach(() => {
  useUiStore.setState({ mode: 'normal', consoleTab: null, paletteOpen: false, transcriptOpen: true })
  useStatusStore.setState({ running: false, startedAt: null, micState: 'idle', systemState: 'idle' })
  useMockStore.setState({ status: { state: 'idle', paused: false } })
  useLlmStore.setState({ entries: [] })
  useTranscriptStore.setState({ segments: [], partials: {} })
  usePresetStore.setState({
    active: 'behavioral',
    presets: [
      { id: 'behavioral', label: 'Behavioral', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
    ],
    hydrated: true,
  })
})

describe('HudBar', () => {
  it('is always visible, unlike the old hover-only control strip', () => {
    const { container } = renderBar()
    expect(container.querySelector('.hud-bar')).toBeTruthy()
    expect(screen.getByText('Idle')).toBeTruthy()
    expect(screen.getByLabelText('Open command palette')).toBeTruthy()
  })

  it('names the current state in words rather than only colouring a dot', () => {
    renderBar()
    expect(screen.getByText('Idle')).toBeTruthy()

    act(() => useStatusStore.setState({ running: true, startedAt: Date.now() }))
    expect(screen.getByText('Listening')).toBeTruthy()

    act(() =>
      useLlmStore.setState({
        entries: [{ requestId: 'r', mode: 'transcript', text: '', chunks: [], status: 'streaming', startedAt: 1 }],
      }),
    )
    expect(screen.getByText('Answering')).toBeTruthy()
  })

  it('shows how long the session has been running', () => {
    act(() => useStatusStore.setState({ running: true, startedAt: Date.now() - 65_000 }))
    const { container } = renderBar()
    expect(container.querySelector('.hud-clock')?.textContent).toBe('1:05')
  })

  it('counts a mock interview down and hides the socket dots it does not use', () => {
    const now = Date.now()
    act(() =>
      useMockStore.setState({
        status: { state: 'active', paused: false, startedAt: now, endsAt: now + 90_000 },
      }),
    )
    const { container } = renderBar()
    expect(screen.getByText('Mock interview')).toBeTruthy()
    expect(container.querySelector('.hud-clock')?.textContent).toBe('1:30')
    expect(container.querySelector('.hud-signals')).toBeNull()
  })

  it('reports a paused mock', () => {
    act(() => useMockStore.setState({ status: { state: 'paused', paused: true } }))
    renderBar()
    expect(screen.getByText('Mock paused')).toBeTruthy()
  })

  it('flips the primary button between Listen and Stop', () => {
    const { props } = renderBar()
    fireEvent.click(screen.getByText('Listen'))
    expect(props.onToggleListening).toHaveBeenCalled()

    act(() => useStatusStore.setState({ running: true }))
    expect(screen.getByText('Stop')).toBeTruthy()
  })

  it('hides the listen control during a mock, so the two cannot fight over the mic', () => {
    act(() => useMockStore.setState({ status: { state: 'active', paused: false } }))
    renderBar()
    expect(screen.queryByText('Listen')).toBeNull()
    expect(screen.queryByText('Stop')).toBeNull()
  })

  it('colours the socket dots by connection state', () => {
    act(() => useStatusStore.setState({ micState: 'open', systemState: 'error' }))
    const { container } = renderBar()
    expect(container.querySelector('.signal-ok')).toBeTruthy()
    expect(container.querySelector('.signal-bad')).toBeTruthy()
  })

  it('surfaces the active interview mode and opens Prompts from it', () => {
    const { props } = renderBar()
    fireEvent.click(screen.getByText('Behavioral'))
    expect(props.onOpenPrompts).toHaveBeenCalled()
  })

  it('omits the mode chip until presets have hydrated', () => {
    act(() => usePresetStore.setState({ active: 'behavioral', presets: [], hydrated: false }))
    const { container } = renderBar()
    expect(container.querySelector('.hud-preset')).toBeNull()
  })

  it('opens the palette and the console from their buttons', () => {
    const { props } = renderBar()
    fireEvent.click(screen.getByLabelText('Open command palette'))
    fireEvent.click(screen.getByLabelText('Open console'))
    expect(props.onOpenPalette).toHaveBeenCalled()
    expect(props.onOpenSetup).toHaveBeenCalled()
  })

  it('toggles the transcript rail and relabels itself', () => {
    renderBar()
    fireEvent.click(screen.getByLabelText('Hide transcript'))
    expect(useUiStore.getState().transcriptOpen).toBe(false)
    expect(screen.getByLabelText('Show transcript')).toBeTruthy()
  })
})
