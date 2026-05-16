// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatusBar } from '@/components/StatusBar'
import { useStatusStore } from '@/state/status-store'
import { usePresetStore } from '@/state/preset-store'
import { useAnswerStyleStore } from '@/state/answer-style-store'
import { installFakeApi, createFakeApi } from '../../helpers/fake-window-api'

beforeEach(() => {
  useStatusStore.setState({ running: false, micState: 'idle', systemState: 'idle' })
  usePresetStore.setState({ active: 'behavioral', presets: [], hydrated: false })
  useAnswerStyleStore.setState({ active: 'concise', styles: [], hydrated: false })
  installFakeApi(createFakeApi())
})

const noopProps = {
  onToggleSettings: vi.fn(),
  onToggleRunning: vi.fn(),
  onClearTranscript: vi.fn(),
  onOpenHelp: vi.fn(),
  onToggleCompact: vi.fn(),
  onQuit: vi.fn(),
}

describe('StatusBar', () => {
  it('shows "Start" when stopped and "Stop" when running', () => {
    const { rerender } = render(<StatusBar {...noopProps} />)
    expect(screen.getByText('Start')).toBeTruthy()
    useStatusStore.setState({ running: true })
    rerender(<StatusBar {...noopProps} />)
    expect(screen.getByText('Stop')).toBeTruthy()
  })

  it('renders both socket dots with titles reflecting their state', () => {
    useStatusStore.setState({ micState: 'open', systemState: 'reconnecting' })
    render(<StatusBar {...noopProps} />)
    expect(screen.getByTitle('You · open')).toBeTruthy()
    expect(screen.getByTitle('Them · reconnecting')).toBeTruthy()
  })

  it('all control buttons fire their callbacks', () => {
    const props = {
      onToggleSettings: vi.fn(),
      onToggleRunning: vi.fn(),
      onClearTranscript: vi.fn(),
      onOpenHelp: vi.fn(),
      onToggleCompact: vi.fn(),
      onQuit: vi.fn(),
    }
    render(<StatusBar {...props} />)
    fireEvent.click(screen.getByText('Start'))
    fireEvent.click(screen.getByLabelText('Clear transcript'))
    fireEvent.click(screen.getByLabelText('Help'))
    fireEvent.click(screen.getByLabelText('Settings'))
    fireEvent.click(screen.getByLabelText('Compact'))
    fireEvent.click(screen.getByLabelText('Quit'))
    expect(props.onToggleRunning).toHaveBeenCalled()
    expect(props.onClearTranscript).toHaveBeenCalled()
    expect(props.onOpenHelp).toHaveBeenCalled()
    expect(props.onToggleSettings).toHaveBeenCalled()
    expect(props.onToggleCompact).toHaveBeenCalled()
    expect(props.onQuit).toHaveBeenCalled()
  })

  it('preset dropdown is hidden until presets are hydrated', () => {
    const { container, rerender } = render(<StatusBar {...noopProps} />)
    expect(container.querySelector('.preset-select')).toBeNull()
    usePresetStore.setState({
      active: 'coding',
      presets: [
        { id: 'coding', label: 'Coding', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
        { id: 'behavioral', label: 'Behavioral', defaultPrompt: 'd', effectivePrompt: 'd', overridden: true },
      ],
      hydrated: true,
    })
    rerender(<StatusBar {...noopProps} />)
    expect(container.querySelector('.preset-select')).toBeTruthy()
  })

  it('changing the preset dropdown calls window.api.presets.setActive', () => {
    usePresetStore.setState({
      active: 'behavioral',
      presets: [
        { id: 'behavioral', label: 'Behavioral', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
        { id: 'coding', label: 'Coding', defaultPrompt: 'd', effectivePrompt: 'd', overridden: false },
      ],
      hydrated: true,
    })
    render(<StatusBar {...noopProps} />)
    fireEvent.change(screen.getByLabelText('Interview mode'), { target: { value: 'coding' } })
    expect((globalThis as { window: { api: { presets: { setActive: ReturnType<typeof vi.fn> } } } }).window.api.presets.setActive).toHaveBeenCalledWith('coding')
  })

  it('changing the answer style dropdown calls window.api.answerStyles.setActive', () => {
    useAnswerStyleStore.setState({
      active: 'concise',
      styles: [
        { id: 'concise', label: 'Concise', instruction: 'short' },
        { id: 'think-aloud', label: 'Think aloud', instruction: 'steps' },
      ],
      hydrated: true,
    })
    render(<StatusBar {...noopProps} />)
    fireEvent.change(screen.getByLabelText('Answer style'), { target: { value: 'think-aloud' } })
    expect((globalThis as { window: { api: { answerStyles: { setActive: ReturnType<typeof vi.fn> } } } }).window.api.answerStyles.setActive).toHaveBeenCalledWith('think-aloud')
  })
})
