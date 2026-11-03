import { describe, expect, it } from 'vitest'
import { calcularDuracion, formatoFecha, hoyIso, sumarDuraciones, textoDuracion } from './fechas'

describe('fechas', () => {
  it('calcula la duración igual que el backend', () => {
    expect(calcularDuracion('2020-01-01', '2020-12-31')).toEqual({ anios: 1, meses: 0, dias: 0 })
    expect(calcularDuracion('2019-03-15', '2021-05-20')).toEqual({ anios: 2, meses: 2, dias: 6 })
    expect(calcularDuracion('2018-06-10', '2023-06-08')).toEqual({ anios: 4, meses: 11, dias: 30 })
    expect(calcularDuracion('2021-01-01', '2020-01-01')).toBeNull()
  })

  it('suma duraciones normalizando', () => {
    expect(sumarDuraciones([{ anios: 1, meses: 11, dias: 20 }, { anios: 0, meses: 0, dias: 15 }])).toEqual({
      anios: 2,
      meses: 0,
      dias: 5,
    })
  })

  it('formatea fechas y duraciones', () => {
    expect(formatoFecha('1985-04-12')).toBe('12/04/1985')
    expect(textoDuracion({ anios: 1, meses: 1, dias: 2 })).toBe('1 año, 1 mes y 2 días')
  })
})

describe('hoyIso', () => {
  it('usa la fecha local y no la de UTC', () => {
    // 22:30 locales del 2 de noviembre: en UTC-5 ya sería el día 3.
    expect(hoyIso(new Date(2026, 10, 2, 22, 30))).toBe('2026-11-02')
  })
})
