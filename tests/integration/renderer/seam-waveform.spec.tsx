// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { SeamWaveform } from '@/components/SeamWaveform'
import { useStatusStore } from '@/state/status-store'

beforeEach(() => {
  useStatusStore.setState({ running: false, micState: 'idle', systemState: 'idle' })
})

describe('SeamWaveform', () => {
  it('renders a single SVG with 4 paths (you+them line + you+them fill) plus a center line', () => {
    const { container } = render(<SeamWaveform />)
    const svg = container.querySelector('svg.seam-waveform')
    expect(svg).toBeTruthy()
    expect(container.querySelectorAll('svg.seam-waveform path').length).toBe(4)
    expect(container.querySelector('svg.seam-waveform line')).toBeTruthy()
  })

  it('adds the "live" class while transcription is running', () => {
    const { container, rerender } = render(<SeamWaveform />)
    expect(container.querySelector('svg.seam-waveform.live')).toBeNull()
    useStatusStore.setState({ running: true })
    rerender(<SeamWaveform />)
    expect(container.querySelector('svg.seam-waveform.live')).toBeTruthy()
  })

  it('respects the height prop', () => {
    const { container } = render(<SeamWaveform height={50} />)
    const svg = container.querySelector('svg.seam-waveform') as SVGElement
    expect(svg.getAttribute('height')).toBe('50')
  })
})
