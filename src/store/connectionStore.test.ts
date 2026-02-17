import { describe, it, expect, beforeEach } from 'vitest'
import { useConnectionStore } from './connectionStore'

describe('connectionStore', () => {
  beforeEach(() => {
    useConnectionStore.setState({ status: 'connecting' })
  })

  it('starts with connecting status', () => {
    expect(useConnectionStore.getState().status).toBe('connecting')
  })

  it('setStatus transitions to connected', () => {
    useConnectionStore.getState().setStatus('connected')
    expect(useConnectionStore.getState().status).toBe('connected')
  })

  it('setStatus transitions to reconnecting', () => {
    useConnectionStore.getState().setStatus('reconnecting')
    expect(useConnectionStore.getState().status).toBe('reconnecting')
  })

  it('setStatus transitions to error', () => {
    useConnectionStore.getState().setStatus('error')
    expect(useConnectionStore.getState().status).toBe('error')
  })

  it('supports full lifecycle: connecting -> connected -> error -> reconnecting -> connected', () => {
    const { setStatus } = useConnectionStore.getState()

    setStatus('connected')
    expect(useConnectionStore.getState().status).toBe('connected')

    setStatus('error')
    expect(useConnectionStore.getState().status).toBe('error')

    setStatus('reconnecting')
    expect(useConnectionStore.getState().status).toBe('reconnecting')

    setStatus('connected')
    expect(useConnectionStore.getState().status).toBe('connected')
  })
})
