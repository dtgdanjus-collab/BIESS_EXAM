// Utilidades de fechas "YYYY-MM-DD" (sin zona horaria).

const partes = (iso) => iso.split('-').map(Number)

/** "1985-04-12" → "12/04/1985" */
export function formatoFecha(iso) {
  if (!iso) return ''
  const [a, m, d] = partes(iso)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`
}

/**
 * Años, meses y días entre dos fechas, ambas inclusivas.
 * Mismo cálculo que el backend (domain.CalcularDuracion).
 */
export function calcularDuracion(inicioIso, finIso) {
  if (!inicioIso || !finIso || finIso < inicioIso) return null
  const [a1, m1, d1] = partes(inicioIso)
  const fin = new Date(Date.UTC(...partes(finIso).map((v, i) => (i === 1 ? v - 1 : v))))
  fin.setUTCDate(fin.getUTCDate() + 1) // fin inclusivo
  let anios = fin.getUTCFullYear() - a1
  let meses = fin.getUTCMonth() + 1 - m1
  let dias = fin.getUTCDate() - d1
  if (dias < 0) {
    meses--
    dias += new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), 0)).getUTCDate()
  }
  if (meses < 0) {
    anios--
    meses += 12
  }
  return { anios, meses, dias }
}

/** Suma normalizando 30 días = 1 mes y 12 meses = 1 año (igual que el backend). */
export function sumarDuraciones(lista) {
  const t = lista.filter(Boolean).reduce(
    (acc, d) => ({ anios: acc.anios + d.anios, meses: acc.meses + d.meses, dias: acc.dias + d.dias }),
    { anios: 0, meses: 0, dias: 0 },
  )
  t.meses += Math.floor(t.dias / 30)
  t.dias %= 30
  t.anios += Math.floor(t.meses / 12)
  t.meses %= 12
  return t
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

/** { anios: 2, meses: 1, dias: 0 } → "2 años, 1 mes y 0 días" */
export function textoDuracion(d) {
  if (!d) return '—'
  return `${plural(d.anios, 'año', 'años')}, ${plural(d.meses, 'mes', 'meses')} y ${plural(d.dias, 'día', 'días')}`
}

export const hoyIso = () => new Date().toISOString().slice(0, 10)
