import { describe, expect, it } from 'vitest'
import { cedulaValida, errorCedula, leerCedula } from './cedula'

describe('leerCedula', () => {
  it('lee cada parte solo cuando ya tiene sus dígitos', () => {
    expect(leerCedula('0')).toEqual({ provincia: null, tercero: null, verificador: null })
    expect(leerCedula('09').provincia).toEqual({ codigo: '09', nombre: 'Guayas' })
    expect(leerCedula('017').tercero).toEqual({ valor: 7, valido: false })
    expect(leerCedula('2502').provincia.nombre).toBeNull()
  })

  it('compara el último dígito con el que da el módulo 10', () => {
    expect(leerCedula('0102345675').verificador).toEqual({ valor: 5, esperado: 5, valido: true })
    expect(leerCedula('0102345674').verificador).toEqual({ valor: 4, esperado: 5, valido: false })
  })
})

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
    expect(errorCedula('0101010122')).toBeNull() // válida aunque no exista en el Registro Civil simulado
  })
})
