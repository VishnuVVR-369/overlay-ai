// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PermissionsBanner } from '@/components/PermissionsBanner'
import { useUiStore } from '@/state/ui-store'
import { installFakeApi, createFakeApi } from '../../helpers/fake-window-api'

beforeEach(() => {
  useUiStore.setState({
    mode: 'normal',
    helpOpen: false,
    settingsOpen: false,
    focused: true,
    permStatus: { mic: 'unknown', screen: 'unknown' },
    expandedEntries: {},
  })
  installFakeApi(createFakeApi())
})

describe('PermissionsBanner', () => {
  it('hides while perms are unknown or both granted', () => {
    const { container, rerender } = render(<PermissionsBanner onRecheck={() => {}} />)
    expect(container.querySelector('.perm-banner')).toBeNull()
    useUiStore.setState({ permStatus: { mic: 'granted', screen: 'granted' } })
    rerender(<PermissionsBanner onRecheck={() => {}} />)
    expect(container.querySelector('.perm-banner')).toBeNull()
  })

  it('shows mic-only copy when only mic is missing', () => {
    useUiStore.setState({ permStatus: { mic: 'denied', screen: 'granted' } })
    render(<PermissionsBanner onRecheck={() => {}} />)
    expect(screen.getByText('Microphone access needed')).toBeTruthy()
  })

  it('shows screen-only copy when only screen is missing', () => {
    useUiStore.setState({ permStatus: { mic: 'granted', screen: 'denied' } })
    render(<PermissionsBanner onRecheck={() => {}} />)
    expect(screen.getByText('Screen recording access needed')).toBeTruthy()
  })

  it('shows combined copy when both are missing', () => {
    useUiStore.setState({ permStatus: { mic: 'denied', screen: 'denied' } })
    render(<PermissionsBanner onRecheck={() => {}} />)
    expect(screen.getByText('Microphone & screen access needed')).toBeTruthy()
  })

  it('Grant calls requestMic / openScreenPrefs and onRecheck after each', async () => {
    useUiStore.setState({ permStatus: { mic: 'denied', screen: 'denied' } })
    const onRecheck = vi.fn()
    render(<PermissionsBanner onRecheck={onRecheck} />)
    fireEvent.click(screen.getByText('Grant'))
    await waitFor(() => {
      const win = (globalThis as { window: { api: { permissions: { requestMic: ReturnType<typeof vi.fn>; openScreenPrefs: ReturnType<typeof vi.fn> } } } }).window
      expect(win.api.permissions.requestMic).toHaveBeenCalled()
      expect(win.api.permissions.openScreenPrefs).toHaveBeenCalled()
      expect(onRecheck).toHaveBeenCalled()
    })
  })
})
