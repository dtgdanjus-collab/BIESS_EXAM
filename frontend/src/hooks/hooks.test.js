import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAsync } from './useAsync'
import { formatoMMSS } from './useCountdown'

describe('useAsync', () => {
  it('pasa por loading → success', async () => {
    const { result } = renderHook(() => useAsync())
    expect(result.current.status).toBe('idle')
    let res
    await act(async () => {
      res = await result.current.run(async () => 42)
    })
    expect(res).toEqual({ ok: true, data: 42 })
    expect(result.current.success).toBe(true)
    expect(result.current.data).toBe(42)
  })

  it('pasa por loading → error sin lanzar', async () => {
    const { result } = renderHook(() => useAsync())
    const fallo = new Error('falló')
    let res
    await act(async () => {
      res = await result.current.run(async () => {
        throw fallo
      })
    })
    expect(res.ok).toBe(false)
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe(fallo)
  })
})

describe('formatoMMSS', () => {
  it('formatea minutos y segundos', () => {
    expect(formatoMMSS(600)).toBe('10:00')
    expect(formatoMMSS(65)).toBe('01:05')
    expect(formatoMMSS(0)).toBe('00:00')
  })
})
