// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HelpPanel } from '@/components/HelpPanel'

describe('HelpPanel', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<HelpPanel open={false} onClose={() => {}} />)
    expect(container.querySelector('.slide-over')).toBeNull()
  })

  it('renders both global and in-window shortcut sections when open', () => {
    render(<HelpPanel open={true} onClose={() => {}} />)
    expect(screen.getByText('Global shortcuts')).toBeTruthy()
    expect(screen.getByText('In-window keys')).toBeTruthy()
  })

  it('lists the four global shortcut labels', () => {
    render(<HelpPanel open={true} onClose={() => {}} />)
    expect(screen.getByText('Ask from transcript')).toBeTruthy()
    expect(screen.getByText('Ask from screen')).toBeTruthy()
    expect(screen.getByText('Toggle visibility')).toBeTruthy()
    expect(screen.getByText('Toggle wide mode')).toBeTruthy()
  })

  it('lists every in-window key', () => {
    render(<HelpPanel open={true} onClose={() => {}} />)
    expect(screen.getByText('Help')).toBeTruthy()
    expect(screen.getByText('Compact mode')).toBeTruthy()
    expect(screen.getByText('Quit')).toBeTruthy()
    expect(screen.getByText('Settings')).toBeTruthy()
    expect(screen.getByText('Toggle transcription')).toBeTruthy()
    expect(screen.getByText('Clear transcript')).toBeTruthy()
  })

  it('Close button and backdrop both call onClose', () => {
    const onClose = vi.fn()
    const { container } = render(<HelpPanel open={true} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close'))
    fireEvent.click(container.querySelector('.slide-over-catcher')!)
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
