import { describe, expect, it } from 'vitest'
import { cedulaValida, errorCedula } from './cedula'

describe('cedulaValida', () => {
  it('acepta las cédulas de las personas mock', () => {
    for (const c of ['0102345675', '0103456786', '1712345675', '0923456784', '1105678906', '0106789019']) {
      expect(cedulaValida(c)).toBe(true)
    }
  })

  it('rechaza cédulas inválidas', () => {
    for (const c of ['0102345674', '2502345675', '0172345675', '010234567', '01023A5675', '']) {
      expect(cedulaValida(c)).toBe(false)
    }
  })
})

describe('errorCedula', () => {
  it('explica el motivo del rechazo', () => {
    expect(errorCedula('')).toBe('Ingrese su número de cédula')
    expect(errorCedula('01023')).toMatch(/10 dígitos \(lleva 5\)/)
    expect(errorCedula('2502345675')).toMatch(/provincia/)
    expect(errorCedula('0172345675')).toMatch(/tercer dígito/)
    expect(errorCedula('0102345674')).toMatch(/dígito verificador/)
    expect(errorCedula('2450320433')).toBeNull() // válida aunque no exista en el Registro Civil simulado
  })
})
